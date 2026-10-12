/** Centralized environment access with safe defaults for development. */
const isProd = process.env.NODE_ENV === "production";

function baseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomains) return `https://${replitDomains}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "http://localhost:5000";
}

export const env = {
  isProd,
  isReplit: Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS),
  baseUrl: baseUrl(),
  sessionSecret: process.env.SESSION_SECRET || "dev-only-session-secret-change-me-dev-only-session-secret",
  databaseUrl: process.env.DATABASE_URL || "postgresql://gid:gid@127.0.0.1:5432/graceindesign",
  sendgridApiKey: process.env.SENDGRID_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Grace In Design <support@graceindesign.net>",
  adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || "support@graceindesign.net",
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID || "",
    token: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_PHONE_NUMBER || "",
  },
  cronSecret: process.env.CRON_SECRET || "dev-cron-secret",
  cft: {
    webhookSecret: process.env.CFT_WEBHOOK_SECRET || "",
    url: (process.env.CFT_URL || "").replace(/\/$/, ""),
    ssoSecret: process.env.CFT_SSO_SECRET || "",
    ssoSecretPrevious: process.env.CFT_SSO_SECRET_PREVIOUS || "",
    appId: process.env.CFT_SSO_APP_ID || "5f1d4a8e-8c3b-4b7e-9c2a-7f3a0d6e1b42",
  },
  objectStorageBucket: process.env.REPLIT_OBJECT_STORAGE_BUCKET || "",
  magnificApiKey: process.env.MAGNIFIC_API_KEY || "",
  etsyShopUrl: process.env.ETSY_SHOP_URL || "https://www.etsy.com/shop/GraceInDesign",
  etsyApiKey: process.env.ETSY_API_KEY || "",
  stripe: { secret: process.env.STRIPE_SECRET_KEY || "", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "" },
  dropboxSignKey: process.env.DROPBOX_SIGN_API_KEY || "",
  hubspotToken: process.env.HUBSPOT_ACCESS_TOKEN || "",
  social: {
    meta: { id: process.env.META_APP_ID || "", secret: process.env.META_APP_SECRET || "" },
    linkedin: { id: process.env.LINKEDIN_CLIENT_ID || "", secret: process.env.LINKEDIN_CLIENT_SECRET || "" },
    pinterest: { id: process.env.PINTEREST_APP_ID || "", secret: process.env.PINTEREST_APP_SECRET || "" },
    youtube: { id: process.env.YOUTUBE_CLIENT_ID || "", secret: process.env.YOUTUBE_CLIENT_SECRET || "" },
  },
  seedOwnerEmails: (process.env.SEED_OWNER_EMAILS || "info@graceindesign.net,emailme@clarencewilliams.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  seedSuperAdminEmail: (process.env.SEED_SUPER_ADMIN_EMAIL || "emailme@clarencewilliams.com").trim().toLowerCase(),
};
