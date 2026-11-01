import { db, siteSettings } from "@/lib/db";
import { eq } from "drizzle-orm";

export type ContactSettings = { phone: string; email: string; hours: string; address: string; addressLine2: string; utilityLabel: string; consultationsNote: string };
export type SocialLink = { name: string; url: string; enabled: boolean };
export type BookingSettings = { durationMin: number; bufferMin: number; minNoticeHours: number; emailConfirm: boolean; smsConfirm: boolean; sendIcs: boolean; attachChecklist: boolean; reminder24h: boolean; horizonDays: number; tz: string };
export type NotificationSettings = {
  /** Email the team on a new consultation request. */
  emailAdminOnNewLead: boolean;
  /** Inbox for sales-related submissions (consultation@). */
  salesEmail: string;
  /** Inbox for everything else: directory/event submissions, portal responses (support@). */
  adminEmail: string;
  /** Text Grace on a new consultation request (through Call Flow Tracker when configured). */
  smsAdminOnNewLead: boolean;
  adminPhone: string;
  /** Slack (incoming webhook) on a new consultation request. */
  slackOnNewLead: boolean;
  /** Slack on the other public forms: directory/event submissions, newsletter and checklist sign-ups. */
  slackOnOtherForms: boolean;
  /** Slack when Call Flow Tracker reports a call, lead or appointment. */
  slackOnCftEvents: boolean;
  /** Put the auto sign-in link into Call Flow Tracker in Slack messages too (keep that channel private). */
  cftLinkInSlack: boolean;
  /** Team member the texts and auto sign-in links are for. Must match their Call Flow Tracker login email. */
  cftUserEmail: string;
};
export type ConversionRules = { createProjectOnSigned: boolean; moveLeadToWon: boolean; copyAnswers: boolean; requestDepositInvoice: boolean; sendWelcomeEmail: boolean };
export type RssSettings = { refreshHours: number; homepageItems: number; useFeedImage: boolean; fallbackImage: boolean };
export type SocialSettings = { showInstagramFeed: boolean; feedCount: number; autoShare: { facebook: boolean; linkedin: boolean; instagram: boolean; pinterest: boolean } };
export type ConsultSettings = { mode: "wizard" | "single"; allowVisitorToggle: boolean };
export type CftRoleMap = Record<string, "owner" | "editor" | "sales" | "social">;
/** Amazon shop: the Associates tracking id goes on every Amazon link and powers the "Add to Amazon cart" buttons. */
export type AmazonSettings = { associateTag: string; cartButtons: boolean };
/**
 * Newsletter: Insta-Newsletter is the list of record and the sender; the website captures sign-ups and
 * pushes them through Insta-Newsletter's v1 API (docs/insta-newsletter-integration.md).
 */
export type NewsletterSettings = {
  /** Insta-Newsletter's address, e.g. https://insta-newsletter.com (links in the admin and the API base). */
  instaUrl: string;
  /** The API key pasted in the admin, AES-encrypted at rest (src/lib/server/crypto.ts). Empty when INSTA_NEWSLETTER_API_KEY is used. */
  instaApiKeyEnc: string;
  /** First characters of the key, so the admin can tell which key is connected. */
  instaApiKeyPrefix: string;
  /** Insta-Newsletter audience id for each website list (src/lib/newsletter.ts AUDIENCES). */
  audienceIds: Record<string, string>;
  /** What /v1/me said when the connection was last checked. */
  instaAccountName: string;
  instaPlan: { name: string; cap: number; used: number; remaining: number } | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  /** Ask Insta-Newsletter to email a confirmation link and add the person only when they click it. */
  doubleOptIn: boolean;
  /** The website's own welcome email on a Caribbean Connection sign-up (off when Insta-Newsletter sends one). */
  sendWelcomeEmail: boolean;
};

export const SETTINGS_DEFAULTS = {
  contact: { phone: "(770) 691-1600", email: "support@graceindesign.net", hours: "Mon–Fri · 9:00am–5:00pm", address: "", addressLine2: "", utilityLabel: "Certified Aging-in-Place Specialists", consultationsNote: "Consultations by appointment" } as ContactSettings,
  footer: { blurb: "Atlanta-based interior design and project management firm, founded in 2008. Registered Interior Designer — Georgia · WELL AP · Certified Aging-in-Place Specialist (CAPS).", copyright: "© 2026 Grace In Design. All rights reserved." },
  social_links: [
    { name: "Facebook", url: "https://facebook.com/graceindesign", enabled: true },
    { name: "Instagram", url: "https://instagram.com/graceindesign", enabled: true },
    { name: "LinkedIn", url: "https://linkedin.com/company/graceindesign", enabled: true },
    { name: "Pinterest", url: "https://pinterest.com/graceindesign", enabled: true },
    { name: "YouTube", url: "https://youtube.com/@graceindesign", enabled: true },
  ] as SocialLink[],
  booking: { durationMin: 15, bufferMin: 15, minNoticeHours: 24, emailConfirm: true, smsConfirm: true, sendIcs: true, attachChecklist: true, reminder24h: true, horizonDays: 21, tz: "America/New_York" } as BookingSettings,
  notifications: { emailAdminOnNewLead: true, salesEmail: "consultation@graceindesign.net", adminEmail: "support@graceindesign.net", smsAdminOnNewLead: true, adminPhone: "", slackOnNewLead: true, slackOnOtherForms: true, slackOnCftEvents: true, cftLinkInSlack: true, cftUserEmail: "info@graceindesign.net" } as NotificationSettings,
  conversion_rules: { createProjectOnSigned: true, moveLeadToWon: true, copyAnswers: true, requestDepositInvoice: false, sendWelcomeEmail: true } as ConversionRules,
  rss: { refreshHours: 1, homepageItems: 3, useFeedImage: true, fallbackImage: true } as RssSettings,
  social: { showInstagramFeed: true, feedCount: 6, autoShare: { facebook: true, linkedin: true, instagram: false, pinterest: true } } as SocialSettings,
  consult_form: { mode: "wizard", allowVisitorToggle: true } as ConsultSettings,
  cft_role_map: { admin: "owner", marketing_manager: "social", partner: "sales", client: "sales" } as CftRoleMap,
  seo: { siteName: "Grace In Design", defaultDescription: "Interior design, Aging In Place and project management in Atlanta." },
  hero_defaults: { slideSeconds: 5 },
  amazon: { associateTag: "", cartButtons: true } as AmazonSettings,
  newsletter: { instaUrl: "", instaApiKeyEnc: "", instaApiKeyPrefix: "", audienceIds: {}, instaAccountName: "", instaPlan: null, connectedAt: null, lastCheckedAt: null, lastCheckError: null, doubleOptIn: false, sendWelcomeEmail: true } as NewsletterSettings,
};
export type SettingKey = keyof typeof SETTINGS_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTINGS_DEFAULTS)[K]> {
  const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.key, key) });
  const def = SETTINGS_DEFAULTS[key];
  if (!row) return def;
  if (def && typeof def === "object" && !Array.isArray(def)) return { ...(def as object), ...(row.value as object) } as (typeof SETTINGS_DEFAULTS)[K];
  return row.value as (typeof SETTINGS_DEFAULTS)[K];
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: (typeof SETTINGS_DEFAULTS)[P] }> {
  const out = {} as { [P in K]: (typeof SETTINGS_DEFAULTS)[P] };
  await Promise.all(keys.map(async (k) => { out[k] = await getSetting(k); }));
  return out;
}

export async function setSetting<K extends SettingKey>(key: K, value: (typeof SETTINGS_DEFAULTS)[K]) {
  await db.insert(siteSettings).values({ key, value: value as unknown, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: value as unknown, updatedAt: new Date() } });
}
