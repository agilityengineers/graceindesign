/**
 * Email + SMS delivery. Every message is written to the `outbox` table, then sent via
 * SendGrid / Twilio when credentials exist. Without credentials the message is kept with
 * status "logged". Authentication bodies are retained only for unexpired retries,
 * never for admin previews; ordinary message retention is unchanged.
 */
import { db, outbox } from "@/lib/db";
import { env } from "@/lib/env";
import { and, eq, isNull } from "drizzle-orm";
import { formatEmailLog, redactAuthUrls } from "./log-redaction.mjs";
import { clearedAuthContent } from "./outbox-privacy";

export type Attachment = { filename: string; contentType: string; contentBase64: string };

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string; attachments?: Attachment[]; relatedType?: string; relatedId?: number; authExpiresAt?: Date }) {
  if (!opts.authExpiresAt && /\/auth\/verify[?#]/i.test(opts.text + (opts.html || ""))) {
    throw new Error("Sign-in emails require an explicit expiry");
  }
  const [row] = await db.insert(outbox).values({
    channel: "email", toAddr: opts.to, subject: opts.subject, bodyText: opts.text, bodyHtml: opts.html ?? textToHtml(opts.text),
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
      if (!env.sendgridApiKey) {
        console.log(formatEmailLog(row));
        await db.update(outbox).set({ status: "logged", provider: "console", attempts: row.attempts + 1, ...(auth ? clearedAuthContent : {}) }).where(eq(outbox.id, id));
        return { ...safeRow, status: "logged" as const };
      }
      const sg = (await import("@sendgrid/mail")).default;
      sg.setApiKey(env.sendgridApiKey);
      const [res] = await sg.send({
        to: row.toAddr, from: env.emailFrom, subject: row.subject || "(no subject)", text: row.bodyText || "", html: row.bodyHtml || undefined,
        // Provider redirect wrappers can move fragment credentials into logged URLs.
        ...(auth ? {
          trackingSettings: { clickTracking: { enable: false, enableText: false } },
        } : {}),
        attachments: row.attachments?.map((a) => ({ filename: a.filename, type: a.contentType, content: a.contentBase64 || "", disposition: "attachment" })),
      });
      await db.update(outbox).set({ status: "sent", provider: "sendgrid", providerId: res.headers?.["x-message-id"] as string | undefined, sentAt: new Date(), attempts: row.attempts + 1, ...(auth ? clearedAuthContent : {}) }).where(eq(outbox.id, id));
      return { ...safeRow, status: "sent" as const };
    }
    if (!env.twilio.sid || !env.twilio.token || !env.twilio.from) {
      console.log(redactAuthUrls(`[outbox:sms → ${row.toAddr}] ${row.bodyText}`));
      await db.update(outbox).set({ status: "logged", provider: "console", attempts: row.attempts + 1 }).where(eq(outbox.id, id));
      return { ...row, status: "logged" as const };
    }
    const twilio = (await import("twilio")).default;
    const client = twilio(env.twilio.sid, env.twilio.token);
    const msg = await client.messages.create({ to: row.toAddr, from: env.twilio.from, body: row.bodyText || "" });
    await db.update(outbox).set({ status: "sent", provider: "twilio", providerId: msg.sid, sentAt: new Date(), attempts: row.attempts + 1 }).where(eq(outbox.id, id));
    return { ...row, status: "sent" as const };
  } catch (e: any) {
    const error = auth ? "Sign-in email delivery failed" : redactAuthUrls(String(e?.message || e));
    console.error("outbox delivery failed", error);
    await db.update(outbox).set({ status: "failed", error: error.slice(0, 1000), attempts: row.attempts + 1,
      ...(auth && (row.attempts + 1 >= 3 || row.authExpiresAt!.getTime() <= Date.now()) ? clearedAuthContent : {}),
    }).where(eq(outbox.id, id));
    return { ...safeRow, status: "failed" as const };
  }
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return d.length >= 8 ? `+${d}` : null;
}

export function textToHtml(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paras = esc.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f2f4f7;padding:24px;font-family:Montserrat,Helvetica,Arial,sans-serif;color:#1a2238;font-size:15px"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e3e6ec"><div style="font-family:Georgia,serif;font-size:22px;margin-bottom:18px"><span style="letter-spacing:.08em">GRACE</span> <span style="background:#6cb6e6;padding:0 6px">IN</span> <span style="letter-spacing:.08em">DESIGN</span></div>${paras}<p style="margin:24px 0 0;font-size:12px;color:#8c95a8">Grace In Design Services, LLC · (770) 691-1600 · support@graceindesign.net</p></div></body></html>`;
}
