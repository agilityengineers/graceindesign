/**
 * Which verified SendGrid sender an email goes out from. Pure (no env, no DB) so it can be
 * unit-tested and imported anywhere.
 *
 * Think of the four addresses as four front doors on the same house:
 *   noreply@      – announcements nobody needs to answer (sign-in links, receipts, reminders to the team)
 *   support@      – general questions that are not about buying something (directory listings, portal, invoices)
 *   consultation@ – anything sales-related: consultation requests, booking confirmations, proposals, drips
 *   newsletter@   – newsletter welcomes, checklist downloads, newsletter issues
 */
export const EMAIL_SENDERS = ["noreply", "support", "consultation", "newsletter"] as const;
export type EmailSender = (typeof EMAIL_SENDERS)[number];

export const DEFAULT_SENDER_ADDRESSES: Record<EmailSender, string> = {
  noreply: "noreply@graceindesign.net",
  support: "support@graceindesign.net",
  consultation: "consultation@graceindesign.net",
  newsletter: "newsletter@graceindesign.net",
};
export const DEFAULT_SENDER_NAME = "Grace In Design";

export type ParsedSender = { name: string; email: string; formatted: string };

/** Accepts "Name <addr@host>" or a bare "addr@host". Falls back to the default name. */
export function parseSender(value: string | undefined | null, fallbackEmail: string, fallbackName = DEFAULT_SENDER_NAME): ParsedSender {
  const raw = (value || "").trim();
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (m) {
    const name = (m[1] || "").trim() || fallbackName;
    const email = m[2].trim().toLowerCase();
    return { name, email, formatted: `${name} <${email}>` };
  }
  if (/^[^<>\s@]+@[^<>\s@]+$/.test(raw)) {
    const email = raw.toLowerCase();
    return { name: fallbackName, email, formatted: `${fallbackName} <${email}>` };
  }
  const email = fallbackEmail.toLowerCase();
  return { name: fallbackName, email, formatted: `${fallbackName} <${email}>` };
}

export type SenderConfigInput = { EMAIL_FROM?: string; EMAIL_FROM_NOREPLY?: string; EMAIL_FROM_SUPPORT?: string; EMAIL_FROM_CONSULTATION?: string; EMAIL_FROM_NEWSLETTER?: string; [key: string]: string | undefined };

/**
 * Resolve the four senders from the environment. `EMAIL_FROM` (the pre-existing single sender)
 * still works as the support@ address so older deployments keep sending.
 */
export function resolveSenders(cfg: SenderConfigInput): Record<EmailSender, ParsedSender> {
  return {
    noreply: parseSender(cfg.EMAIL_FROM_NOREPLY, DEFAULT_SENDER_ADDRESSES.noreply),
    support: parseSender(cfg.EMAIL_FROM_SUPPORT || cfg.EMAIL_FROM, DEFAULT_SENDER_ADDRESSES.support),
    consultation: parseSender(cfg.EMAIL_FROM_CONSULTATION, DEFAULT_SENDER_ADDRESSES.consultation),
    newsletter: parseSender(cfg.EMAIL_FROM_NEWSLETTER, DEFAULT_SENDER_ADDRESSES.newsletter),
  };
}

export function isEmailSender(v: unknown): v is EmailSender {
  return typeof v === "string" && (EMAIL_SENDERS as readonly string[]).includes(v);
}
