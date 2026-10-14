// server-only (also used by scripts/cron.ts)
/**
 * One place that tells the team something happened. Picture a switchboard: a form submission
 * comes in on one wire and goes out on up to three — email to the right inbox, a Slack post, and a
 * text to Grace that carries a link signing her straight into Call Flow Tracker. Every wire is
 * best-effort: a Slack outage never blocks the lead from being saved or the visitor's confirmation.
 */
import { env } from "@/lib/env";
import { getSetting } from "@/lib/server/settings";
import { sendEmail, sendSms } from "@/lib/server/outbox";
import { notifySlack, slackConfigured, type SlackButton } from "@/lib/server/slack";
import { createCftLaunchLink } from "@/lib/server/cft-links";
import { normalizePhone } from "@/lib/server/outbox-phone";
import { redactAuthUrls } from "./log-redaction.mjs";

export type TeamNoticeKind = "lead" | "cc_submission" | "subscriber" | "cft_event";

export type TeamNotice = {
  kind: TeamNoticeKind;
  /** Headline for email subject + Slack header. */
  title: string;
  /** Plain-text body for the email (and the log). */
  body: string;
  /** Label/value pairs for Slack. */
  fields?: [string, string][];
  /** Where this lives in the admin, e.g. "/admin/leads?open=12". */
  adminPath?: string;
  /** Reply-To on the team email — the visitor's address so "Reply" answers them directly. */
  replyTo?: string;
  /** Short text for SMS (a link is appended). Omit to skip SMS even when enabled. */
  sms?: string;
  /** CFT path hint for the sign-in link (CFT lands on its dashboard today; kept for when it honours targets). */
  cftTarget?: string;
  relatedType?: string; relatedId?: number;
};

export type TeamNoticeResult = { email: boolean; slack: boolean; sms: boolean; cftLink: string | null; errors: string[] };

export async function notifyTeam(n: TeamNotice): Promise<TeamNoticeResult> {
  const out: TeamNoticeResult = { email: false, slack: false, sms: false, cftLink: null, errors: [] };
  let linkExpiresAt: Date | undefined;
  const s = await getSetting("notifications");
  const adminUrl = n.adminPath ? `${env.baseUrl}${n.adminPath}` : `${env.baseUrl}/admin`;
  // Sign-ups and CFT events are Slack-only: an email per newsletter subscriber would just be inbox noise.
  const wantEmail = n.kind === "lead" ? s.emailAdminOnNewLead : n.kind === "cc_submission";
  const wantSlack = n.kind === "lead" ? s.slackOnNewLead : n.kind === "cft_event" ? s.slackOnCftEvents : s.slackOnOtherForms;
  const phone = normalizePhone(s.adminPhone || env.adminNotifyPhone);
  const wantSms = n.kind === "lead" && s.smsAdminOnNewLead && Boolean(phone) && Boolean(n.sms);

  // The auto sign-in link is only minted when someone will actually receive it.
  const needLink = Boolean(env.cft.url) && (wantSms || (wantSlack && s.cftLinkInSlack && slackConfigured()));
  if (needLink) {
    try {
      const link = await createCftLaunchLink({ target: n.cftTarget || null, purpose: n.kind === "lead" ? "lead" : n.kind === "cc_submission" ? "cc_submission" : n.kind === "subscriber" ? "subscriber" : "cft_call", relatedType: n.relatedType, relatedId: n.relatedId });
      out.cftLink = link?.url ?? null;
      linkExpiresAt = link?.expiresAt;
    } catch (e: any) { out.errors.push(`cft link: ${String(e?.message || e)}`); }
  }

  if (wantEmail) {
    const to = n.kind === "lead" ? (s.salesEmail || env.salesNotifyEmail) : (s.adminEmail || env.adminNotifyEmail);
    try {
      const r = await sendEmail({ to, from: "noreply", replyTo: n.replyTo, subject: n.title, relatedType: n.relatedType, relatedId: n.relatedId, text: `${n.body}\n\nOpen in admin: ${adminUrl}${env.cft.url ? `\nCall Flow Tracker: ${env.cft.url}` : ""}` });
      out.email = r?.status === "sent" || r?.status === "logged";
      if (r?.status === "failed") out.errors.push(`email: ${(r as { error?: string }).error || "failed"}`);
    } catch (e: any) { out.errors.push(`email: ${String(e?.message || e)}`); }
  }

  if (wantSlack) {
    const buttons: SlackButton[] = [{ label: "Open in admin", url: adminUrl, primary: true }];
    if (env.cft.url) buttons.push({ label: "Open Call Flow Tracker", url: s.cftLinkInSlack && out.cftLink ? out.cftLink : env.cft.url });
    const r = await notifySlack({ title: n.title, text: n.kind === "cft_event" ? n.body : undefined, fields: n.fields, buttons, context: `${sourceLabel(n.kind)} · graceindesign.net${out.cftLink && s.cftLinkInSlack ? " · the Call Flow Tracker button signs Grace in automatically — keep this channel private" : ""}` });
    out.slack = r.sent;
    if (!r.sent && slackConfigured()) out.errors.push(`slack: ${r.error}`);
  }

  if (wantSms && phone) {
    const link = out.cftLink || adminUrl;
    const text = `${n.sms}\n${link}`.slice(0, 600);
    try {
      const r = await sendSms({ to: phone, body: text, authExpiresAt: linkExpiresAt, relatedType: n.relatedType, relatedId: n.relatedId });
      out.sms = r?.status === "sent" || r?.status === "logged";
      if (r?.status === "failed") out.errors.push(`sms: ${(r as { error?: string }).error || "failed"}`);
    } catch (e: any) { out.errors.push(`sms: ${String(e?.message || e)}`); }
  }
  // Notification callers must not retain bearer links in action responses or logs.
  out.cftLink = null;
  out.errors = out.errors.map(redactAuthUrls);
  return out;
}

function sourceLabel(kind: TeamNoticeKind) {
  return { lead: "Consultation form", cc_submission: "Caribbean Connection form", subscriber: "Newsletter sign-up", cft_event: "Call Flow Tracker" }[kind];
}

/** Human summary of which channels fired, for the lead activity log. */
export function describeNotice(r: TeamNoticeResult) {
  const parts = [r.email && "email", r.slack && "Slack", r.sms && "SMS"].filter(Boolean) as string[];
  const base = parts.length ? `Team notified via ${parts.join(", ")}` : "Team notification skipped (all channels off)";
  return r.errors.length ? `${base} · issues: ${r.errors.join("; ")}` : base;
}
