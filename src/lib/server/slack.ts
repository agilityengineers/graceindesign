// server-only (also used by scripts/cron.ts)
/**
 * Slack notifications through an Incoming Webhook (SLACK_WEBHOOK_URL). One webhook posts to one
 * channel chosen when it was created in Slack, so there is nothing to configure here beyond the URL.
 * Without the URL every call is a logged no-op, so the funnel keeps working.
 */
import { env } from "@/lib/env";
import { redactAuthUrls } from "./log-redaction.mjs";

const TIMEOUT_MS = 8000;

export type SlackButton = { label: string; url: string; primary?: boolean };
export type SlackMessage = {
  /** Headline, e.g. "New consultation request" */
  title: string;
  /** "Label: value" rows shown as fields; long values are fine. */
  fields?: [string, string][];
  /** Free text paragraph (mrkdwn). */
  text?: string;
  buttons?: SlackButton[];
  /** Small grey line at the bottom. */
  context?: string;
};

export function slackConfigured() { return /^https:\/\/hooks\.slack\.com\//.test(env.slack.webhookUrl); }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Block Kit payload for a message; exported so it can be unit-tested without posting. */
export function buildSlackPayload(m: SlackMessage) {
  const blocks: Record<string, unknown>[] = [{ type: "header", text: { type: "plain_text", text: m.title.slice(0, 150), emoji: true } }];
  if (m.text) blocks.push({ type: "section", text: { type: "mrkdwn", text: esc(m.text).slice(0, 2900) } });
  const fields = (m.fields || []).filter(([, v]) => v && String(v).trim());
  for (let i = 0; i < fields.length; i += 10) {
    blocks.push({ type: "section", fields: fields.slice(i, i + 10).map(([k, v]) => ({ type: "mrkdwn", text: `*${esc(k)}*\n${esc(String(v)).slice(0, 1900)}` })) });
  }
  if (m.buttons?.length) {
    blocks.push({ type: "actions", elements: m.buttons.slice(0, 5).map((b, i) => ({ type: "button", text: { type: "plain_text", text: b.label.slice(0, 75), emoji: true }, url: b.url, action_id: `btn_${i}`, ...(b.primary ? { style: "primary" } : {}) })) });
  }
  if (m.context) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: esc(m.context).slice(0, 2900) }] });
  const fallback = [m.title, ...fields.map(([k, v]) => `${k}: ${v}`), ...(m.buttons || []).map((b) => `${b.label}: ${b.url}`)].join(" · ");
  return { text: fallback.slice(0, 3000), blocks };
}

/** Post to Slack. Never throws — a Slack hiccup must not break a form submission. Returns whether it was sent. */
export async function notifySlack(m: SlackMessage): Promise<{ sent: boolean; error?: string }> {
  const payload = buildSlackPayload(m);
  if (!slackConfigured()) {
    console.log(redactAuthUrls(`[slack:logged] ${payload.text}`));
    return { sent: false, error: "SLACK_WEBHOOK_URL not set" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(env.slack.webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) { console.error("slack webhook failed", res.status); return { sent: false, error: `HTTP ${res.status}` }; }
    return { sent: true };
  } catch (e: any) {
    console.error("slack webhook error");
    return { sent: false, error: "Slack delivery failed" };
  }
}
