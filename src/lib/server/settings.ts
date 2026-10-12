import { db, siteSettings } from "@/lib/db";
import { eq } from "drizzle-orm";

export type ContactSettings = { phone: string; email: string; hours: string; address: string; addressLine2: string; utilityLabel: string; consultationsNote: string };
export type SocialLink = { name: string; url: string; enabled: boolean };
export type BookingSettings = { durationMin: number; bufferMin: number; minNoticeHours: number; emailConfirm: boolean; smsConfirm: boolean; sendIcs: boolean; attachChecklist: boolean; reminder24h: boolean; horizonDays: number; tz: string };
export type NotificationSettings = { emailAdminOnNewLead: boolean; adminEmail: string; smsAdminOnNewLead: boolean; adminPhone: string };
export type ConversionRules = { createProjectOnSigned: boolean; moveLeadToWon: boolean; copyAnswers: boolean; requestDepositInvoice: boolean; sendWelcomeEmail: boolean };
export type RssSettings = { refreshHours: number; homepageItems: number; useFeedImage: boolean; fallbackImage: boolean };
export type SocialSettings = { showInstagramFeed: boolean; feedCount: number; autoShare: { facebook: boolean; linkedin: boolean; instagram: boolean; pinterest: boolean } };
export type ConsultSettings = { mode: "wizard" | "single"; allowVisitorToggle: boolean };
export type CftRoleMap = Record<string, "owner" | "editor" | "sales" | "social">;

export const SETTINGS_DEFAULTS = {
  contact: { phone: "(770) 691-1600", email: "support@graceindesign.net", hours: "Mon–Fri · 9:00am–5:00pm", address: "Street address", addressLine2: "City, State ZIP", utilityLabel: "Certified Aging-in-Place Specialists", consultationsNote: "Consultations by appointment" } as ContactSettings,
  footer: { blurb: "Atlanta-based interior design and project management firm, founded in 2008. Registered Interior Designer — Georgia · WELL AP · Certified Aging-In-Place Specialist (CAPS).", copyright: "© 2026 Grace In Design. All rights reserved." },
  social_links: [
    { name: "Facebook", url: "https://facebook.com/graceindesign", enabled: true },
    { name: "Instagram", url: "https://instagram.com/graceindesign", enabled: true },
    { name: "LinkedIn", url: "https://linkedin.com/company/graceindesign", enabled: true },
    { name: "Pinterest", url: "https://pinterest.com/graceindesign", enabled: true },
    { name: "YouTube", url: "https://youtube.com/@graceindesign", enabled: true },
  ] as SocialLink[],
  booking: { durationMin: 15, bufferMin: 15, minNoticeHours: 24, emailConfirm: true, smsConfirm: true, sendIcs: true, attachChecklist: true, reminder24h: true, horizonDays: 21, tz: "America/New_York" } as BookingSettings,
  notifications: { emailAdminOnNewLead: true, adminEmail: "support@graceindesign.net", smsAdminOnNewLead: false, adminPhone: "" } as NotificationSettings,
  conversion_rules: { createProjectOnSigned: true, moveLeadToWon: true, copyAnswers: true, requestDepositInvoice: false, sendWelcomeEmail: true } as ConversionRules,
  rss: { refreshHours: 1, homepageItems: 3, useFeedImage: true, fallbackImage: true } as RssSettings,
  social: { showInstagramFeed: true, feedCount: 6, autoShare: { facebook: true, linkedin: true, instagram: false, pinterest: true } } as SocialSettings,
  consult_form: { mode: "wizard", allowVisitorToggle: true } as ConsultSettings,
  cft_role_map: { admin: "owner", marketing_manager: "social", partner: "sales", client: "sales" } as CftRoleMap,
  seo: { siteName: "Grace In Design", defaultDescription: "Interior design, aging-in-place and project management in Atlanta." },
  hero_defaults: { slideSeconds: 5 },
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
