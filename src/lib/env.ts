/** Centralized environment access with safe defaults for development. */
import { resolveBaseUrl } from "./base-url";
import { resolveSenders } from "./email-senders";
const isProd = process.env.NODE_ENV === "production";

const senders = resolveSenders(process.env);
/** Call Flow Tracker's own master-dashboard app id (shared/masterDashboardConfig.ts in CFT). */
export const CFT_MASTER_APP_ID_DEFAULT = "608c99a8-0a2b-41d7-8930-f2dc3b0fe964";

export const env = {
  isProd,
  isReplit: Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS),
  baseUrl: resolveBaseUrl(process.env),
  sessionSecret: process.env.SESSION_SECRET || "dev-only-session-secret-change-me-dev-only-session-secret",
  databaseUrl: process.env.DATABASE_URL || "postgresql://gid:gid@127.0.0.1:5432/graceindesign",
  sendgridApiKey: process.env.SENDGRID_API_KEY || "",
  /** Legacy single sender — now the support@ sender's "Name <addr>" string. */
  emailFrom: senders.support.formatted,
  /** The four verified SendGrid senders (see src/lib/email-senders.ts for which is used when). */
  senders,
  /** Where non-sales inquiries and internal notices land (support@). */
  adminNotifyEmail: process.env.ADMIN_NOTIFY_EMAIL || senders.support.email,
  /** Where consultation / sales form submissions land (consultation@). */
  salesNotifyEmail: process.env.SALES_NOTIFY_EMAIL || senders.consultation.email,
  /** Grace's mobile for new-lead texts; the admin setting overrides this. */
  adminNotifyPhone: process.env.ADMIN_NOTIFY_PHONE || "",
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  },
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
    // GID → CFT: this app signs people *into* Call Flow Tracker using CFT's master-dashboard SSO
    // (CFT's MASTER_DASHBOARD_SECRET) and sends team texts through CFT's Twilio connection.
    masterSecret: process.env.CFT_MASTER_DASHBOARD_SECRET || "",
    masterAppId: process.env.CFT_MASTER_APP_ID || CFT_MASTER_APP_ID_DEFAULT,
    /** Tracking number (E.164) in CFT that team texts are sent from. */
    smsFrom: process.env.CFT_SMS_FROM || "",
    /** CFT login email of the person whose CFT session sends those texts (defaults to the notification user). */
    smsSenderEmail: (process.env.CFT_SMS_SENDER_EMAIL || "").trim().toLowerCase(),
  },
  objectStorageBucket: process.env.REPLIT_OBJECT_STORAGE_BUCKET || "",
  magnificApiKey: process.env.MAGNIFIC_API_KEY || "",
  etsyShopUrl: process.env.ETSY_SHOP_URL || "https://www.etsy.com/shop/GraceInDesign",
  amazon: {
    /** Product Advertising API 5 keys (Associates Central → Tools → Product Advertising API). Without them, listings are read from the public page. */
    accessKey: process.env.AMAZON_PAAPI_ACCESS_KEY || "",
    secretKey: process.env.AMAZON_PAAPI_SECRET_KEY || "",
    /** Associates tracking id, e.g. graceindesign-20. Site settings → Amazon shop overrides it. */
    partnerTag: process.env.AMAZON_ASSOCIATE_TAG || "",
    /** Storefront the links and cart point at. */
    marketplace: process.env.AMAZON_MARKETPLACE || "www.amazon.com",
  },
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
