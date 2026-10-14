/**
 * Email + SMS delivery. Every message is written to the `outbox` table, then sent via
 * SendGrid (email) or Call Flow Tracker → Twilio / direct Twilio (SMS) when credentials exist.
 * Without credentials the message is kept with status "logged" so the flow is fully testable and
 * the admin can see what would go out.
 *
 * Email leaves from one of four verified SendGrid senders (see src/lib/email-senders.ts):
 * noreply@ for things nobody needs to answer, support@ for general questions, consultation@ for
 * anything sales-related, newsletter@ for newsletter mail. Callers pick with `from`.
 *
 * SMS goes through Call Flow Tracker first (its Twilio account + Grace's tracking number, so
 * replies land in CFT's inbox), then this app's own Twilio keys, then the log.
 */
import { db, outbox } from "@/lib/db";
import { env } from "@/lib/env";
import { and, eq, isNull } from "drizzle-orm";
import { clearedAuthContent } from "./outbox-privacy";
import { isEmailSender, type EmailSender } from "@/lib/email-senders";
import { formatEmailLog, redactAuthUrls } from "./log-redaction.mjs";
import { normalizePhone } from "./outbox-phone";
import { cftSmsConfigured, sendSmsViaCft } from "./cft-master";

export { normalizePhone };

export type Attachment = { filename: string; contentType: string; contentBase64: string };

export type SendEmailOptions = {
  authExpiresAt?: Date;
  to: string; subject: string; text: string; html?: string; attachments?: Attachment[]; relatedType?: string; relatedId?: number;
  /** Which verified sender to use (default: support). A full "Name <addr>" string is also accepted. */
  from?: EmailSender | string;
  /** Optional Reply-To (e.g. consultation@ on a noreply@ announcement). */
  replyTo?: string;
};

/** "Grace In Design <consultation@graceindesign.net>" for a sender key, or the literal string given. */
export function resolveFrom(from: EmailSender | string | undefined | null): { formatted: string; email: string } {
  if (!from) return { formatted: env.senders.support.formatted, email: env.senders.support.email };
  if (isEmailSender(from)) return { formatted: env.senders[from].formatted, email: env.senders[from].email };
  const m = from.match(/<([^<>]+)>/);
  return { formatted: from, email: (m ? m[1] : from).trim().toLowerCase() };
}

export async function sendEmail(opts: SendEmailOptions) {
  if (!opts.authExpiresAt && /\/auth\/verify[?#]/i.test(opts.text + (opts.html || ""))) {
    throw new Error("Sign-in emails require an explicit expiry");
  }
  const from = resolveFrom(opts.from);
  const [row] = await db.insert(outbox).values({
    channel: "email", toAddr: opts.to, fromAddr: from.formatted, replyTo: opts.replyTo || null, subject: opts.subject, bodyText: opts.text,
    bodyHtml: opts.html ?? textToHtml(opts.text, from.email),
    attachments: opts.attachments?.map((a) => ({ filename: a.filename, contentType: a.contentType, contentBase64: a.contentBase64 })),
    relatedType: opts.relatedType, relatedId: opts.relatedId, status: "queued", authExpiresAt: opts.authExpiresAt,
  }).returning();
  return deliverOutbox(row.id);
}

export async function sendSms(opts: { to: string; body: string; relatedType?: string; relatedId?: number }) {
  const to = normalizePhone(opts.to);
  if (!to) return null;
  const [row] = await db.insert(outbox).values({ channel: "sms", toAddr: to, bodyText: opts.body, relatedType: opts.relatedType, relatedId: opts.relatedId, status: "queued" }).returning();
  return deliverOutbox(row.id);
}

/** An admin retry must not reset authentication delivery metadata or limits. */
export async function retryOutbox(id: number) {
  const [row] = await db.select({
    authExpiresAt: outbox.authExpiresAt, status: outbox.status, attempts: outbox.attempts,
  }).from(outbox).where(eq(outbox.id, id));
  if (!row) throw new Error("Message not found");
  if (row.authExpiresAt && (row.status === "sent" || row.status === "logged" ||
    row.attempts >= 3 || row.authExpiresAt.getTime() <= Date.now())) {
    await db.update(outbox).set(clearedAuthContent).where(eq(outbox.id, id));
    throw new Error("This sign-in message cannot be resent. Request a new sign-in link.");
  }
  await db.update(outbox).set({ status: "queued", error: null })
    .where(and(eq(outbox.id, id), isNull(outbox.authExpiresAt)));
  return deliverOutbox(id);
}

/** Which SMS route is live, for the admin and for docs: cft | twilio | logged. */
export function smsRoute(): "cft" | "twilio" | "logged" {
  if (cftSmsConfigured()) return "cft";
  if (env.twilio.sid && env.twilio.token && env.twilio.from) return "twilio";
  return "logged";
}

export async function deliverOutbox(id: number) {
  const row = await db.query.outbox.findFirst({ where: eq(outbox.id, id) });
  if (!row) return null;
  const auth = row.authExpiresAt !== null;
  // Never return bearer content to callers, even while a retry needs it in storage.
  const safeRow = auth ? { ...row, ...clearedAuthContent } : row;
  if (auth && (row.status === "sent" || row.status === "logged" || row.attempts >= 3 ||
    row.authExpiresAt!.getTime() <= Date.now() || !row.bodyText)) {
    const status = row.status === "sent" || row.status === "logged" ? row.status : "failed";
    await db.update(outbox).set({ ...clearedAuthContent, status }).where(eq(outbox.id, id));
    return { ...safeRow, status };
  }
  try {
    if (row.channel === "email") {
      const from = row.fromAddr || env.senders.support.formatted;
      if (!env.sendgridApiKey) {
        console.log(formatEmailLog(row));
        await db.update(outbox).set({ status: "logged", provider: "console", fromAddr: from, attempts: row.attempts + 1, ...(auth ? clearedAuthContent : {}) }).where(eq(outbox.id, id));
        return { ...safeRow, status: "logged" as const };
      }
      const sg = (await import("@sendgrid/mail")).default;
      sg.setApiKey(env.sendgridApiKey);
      const [res] = await sg.send({
        to: row.toAddr, from, subject: row.subject || "(no subject)", text: row.bodyText || "", html: row.bodyHtml || undefined,
        ...(row.replyTo ? { replyTo: row.replyTo } : {}),
        // Provider redirect wrappers can move fragment credentials into logged URLs.
        ...(auth ? {
          trackingSettings: { clickTracking: { enable: false, enableText: false } },
        } : {}),
        attachments: row.attachments?.map((a) => ({ filename: a.filename, type: a.contentType, content: a.contentBase64 || "", disposition: "attachment" })),
      });
      await db.update(outbox).set({ status: "sent", provider: "sendgrid", fromAddr: from, providerId: res.headers?.["x-message-id"] as string | undefined, sentAt: new Date(), attempts: row.attempts + 1, ...(auth ? clearedAuthContent : {}) }).where(eq(outbox.id, id));
      return { ...safeRow, status: "sent" as const };
    }
    // ---- SMS: Call Flow Tracker → Twilio → logged ----
    const route = smsRoute();
    if (route === "cft") {
      const r = await sendSmsViaCft({ to: row.toAddr, body: row.bodyText || "" });
      await db.update(outbox).set({ status: "sent", provider: "cft", providerId: r.messageSid || null, fromAddr: r.from, sentAt: new Date(), attempts: row.attempts + 1 }).where(eq(outbox.id, id));
      return { ...row, status: "sent" as const };
    }
    if (route === "logged") {
      console.log(redactAuthUrls(`[outbox:sms → ${row.toAddr}] ${row.bodyText}`));
      await db.update(outbox).set({ status: "logged", provider: "console", attempts: row.attempts + 1 }).where(eq(outbox.id, id));
      return { ...row, status: "logged" as const };
    }
    const twilio = (await import("twilio")).default;
    const client = twilio(env.twilio.sid, env.twilio.token);
    const msg = await client.messages.create({ to: row.toAddr, from: env.twilio.from, body: row.bodyText || "" });
    await db.update(outbox).set({ status: "sent", provider: "twilio", providerId: msg.sid, fromAddr: env.twilio.from, sentAt: new Date(), attempts: row.attempts + 1 }).where(eq(outbox.id, id));
    return { ...row, status: "sent" as const };
  } catch (e: any) {
    const error = auth ? "Sign-in email delivery failed" : redactAuthUrls(String(e?.message || e));
    console.error("outbox delivery failed", error);
    await db.update(outbox).set({ status: "failed", error: error.slice(0, 1000), attempts: row.attempts + 1,
      ...(auth && (row.attempts + 1 >= 3 || row.authExpiresAt!.getTime() <= Date.now()) ? clearedAuthContent : {}),
    }).where(eq(outbox.id, id));
    return { ...safeRow, status: "failed" as const, error };
  }
}

export function textToHtml(text: string, footerEmail = env.senders.support.email) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = esc.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f2f4f7;padding:24px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#1a2238;font-size:15px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e3e6ec"><div style="font-family:Georgia,serif;font-size:22px;margin-bottom:18px"><span style="letter-spacing:.08em">GRACE</span> <span style="background:#6cb6e6;padding:0 6px">IN</span> <span style="letter-spacing:.08em">DESIGN</span></div>${paras}<p style="margin:24px 0 0;font-size:12px;color:#8c95a8">Grace In Design Services, LLC · (770) 691-1600 · ${footerEmail}</p></div></body></html>`;
}
