/**
 * Grace In Design — database schema (Drizzle ORM, PostgreSQL).
 * Tables follow design/Roadmap.dc.html "Data model" plus Phase 3/4 tables and the
 * integration surface for Call Flow Tracker (webhooks in/out, SSO).
 */
import {
  pgTable, pgEnum, serial, text, integer, boolean, timestamp, jsonb, numeric, date, index, unique, type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum("user_role", ["owner", "editor", "sales", "social"]);
export const leadStageEnum = pgEnum("lead_stage", ["new", "contacted", "consultation_booked", "proposal_sent", "won", "lost", "nurture"]);
export const moderationStatusEnum = pgEnum("moderation_status", ["pending", "published", "rejected"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "scheduled", "paid", "void"]);
export const bookingStatusEnum = pgEnum("booking_status", ["booked", "done", "no_show", "cancelled"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "archived"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "closed", "archived"]);
export const heroStyleEnum = pgEnum("hero_style", ["classic", "cinematic"]);
export const outboxStatusEnum = pgEnum("outbox_status", ["queued", "sent", "failed", "logged"]);
export const socialPostStatusEnum = pgEnum("social_post_status", ["draft", "scheduled", "publishing", "published", "failed"]);
export const proposalStatusEnum = pgEnum("proposal_status", ["draft", "sent", "viewed", "signed", "declined"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "changes_requested"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "completed", "stopped"]);

export { LEAD_STAGES, LEAD_STAGE_LABELS, USER_ROLES, USER_ROLE_LABELS, type LeadStage, type UserRole } from "./constants";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// ---------------------------------------------------------------------------
// Users, auth, SSO
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("editor"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  avatarUrl: text("avatar_url"),
  title: text("title"),
  // Call Flow Tracker users.id (string) once linked through Connected Apps SSO.
  cftUserId: text("cft_user_id").unique(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  source: text("source").notNull().default("magic_link"), // magic_link | cft_sso
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userIdx: index("sessions_user_idx").on(t.userId) }));

export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  redirectTo: text("redirect_to"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ssoJtis = pgTable("sso_jtis", {
  jti: text("jti").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(), // create | update | delete | publish | ...
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ entityIdx: index("audit_entity_idx").on(t.entity, t.entityId) }));

// ---------------------------------------------------------------------------
// Settings & integrations
// ---------------------------------------------------------------------------
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // sendgrid | twilio | etsy | rss | meta | linkedin | pinterest | youtube | stripe | esign | hubspot | cft | magnific
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  phase: integer("phase").notNull().default(1),
  status: text("status").notNull().default("not_connected"), // connected | not_connected | planned | error
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Consultation funnel: paths, form fields, availability, leads, bookings
// ---------------------------------------------------------------------------
export const paths = pgTable("paths", {
  id: text("id").primaryKey(), // residential, design-refresh, aging-in-place, ...
  label: text("label").notNull(),
  short: text("short").notNull(),
  consultType: text("consult_type").notNull().default("15-min discovery call"),
  pageKeys: text("page_keys").array().notNull().default(sql`'{}'::text[]`),
  color: text("color").notNull().default("#6cb6e6"),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const formFields = pgTable("form_fields", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(), // text, email, phone, select, multiselect, textarea, address, date, upload, consent, yesno
  options: jsonb("options").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(false),
  scope: text("scope").notNull().default("base"), // base | path
  pathId: text("path_id").references(() => paths.id, { onDelete: "cascade" }),
  step: text("step").notNull().default("project"), // path | project | contact | schedule | review
  sort: integer("sort").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  ...timestamps,
}, (t) => ({ scopeIdx: index("form_fields_scope_idx").on(t.scope, t.pathId) }));

export const availabilityBlocks = pgTable("availability_blocks", {
  id: serial("id").primaryKey(),
  label: text("label"),
  weekdays: integer("weekdays").array().notNull().default(sql`'{}'::integer[]`), // 0=Sun..6=Sat
  date: date("date"), // optional one-off date
  startTime: text("start_time").notNull(), // HH:MM (24h, ET)
  endTime: text("end_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  contactPref: text("contact_pref"),
  contactTime: text("contact_time"),
  sourcePage: text("source_page").notNull().default("general"),
  sourceLabel: text("source_label"),
  pathId: text("path_id").references(() => paths.id, { onDelete: "set null" }),
  utm: jsonb("utm").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  stage: leadStageEnum("stage").notNull().default("new"),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  budget: text("budget"),
  timeline: text("timeline"),
  address: text("address"),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  notes: text("notes"),
  followUpAt: date("follow_up_at"),
  externalId: text("external_id"), // e.g. CFT contact id
  externalSource: text("external_source"), // cft | hubspot
  archived: boolean("archived").notNull().default(false),
  convertedProjectId: integer("converted_project_id"),
  hubspotId: text("hubspot_id"),
  ...timestamps,
}, (t) => ({ stageIdx: index("leads_stage_idx").on(t.stage), emailIdx: index("leads_email_idx").on(t.email), extIdx: index("leads_external_idx").on(t.externalSource, t.externalId) }));

export const leadActivity = pgTable("lead_activity", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(), // note | call | email | sms | proposal | stage | system | booking | webhook
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ leadIdx: index("lead_activity_lead_idx").on(t.leadId) }));

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull().default("discovery_15"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  tz: text("tz").notNull().default("America/New_York"),
  status: bookingStatusEnum("status").notNull().default("booked"),
  icsSentAt: timestamp("ics_sent_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  notes: text("notes"),
  externalId: text("external_id"),
  ...timestamps,
}, (t) => ({ startIdx: index("bookings_start_idx").on(t.startsAt) }));

// ---------------------------------------------------------------------------
// Project pipeline
// ---------------------------------------------------------------------------
export const projectPhases = pgTable("project_phases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#1a2238"),
  sort: integer("sort").notNull().default(0),
});

export const projectStages = pgTable("project_stages", {
  id: serial("id").primaryKey(),
  phaseId: integer("phase_id").references(() => projectPhases.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  sort: integer("sort").notNull().default(0),
  automation: text("automation").notNull().default("none"), // none | request_deposit | send_invoice | client_approval | schedule_install | request_review
});

export const projectFields = pgTable("project_fields", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  type: text("type").notNull(), // currency | file | address | date | user | longtext | number | toggle
  enabled: boolean("enabled").notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  leadName: text("lead_name"),
  serviceId: integer("service_id").references((): AnyPgColumn => services.id, { onDelete: "set null" }),
  serviceName: text("service_name"),
  name: text("name").notNull(),
  stageId: integer("stage_id").references(() => projectStages.id, { onDelete: "set null" }),
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  contractValue: numeric("contract_value", { precision: 12, scale: 2 }),
  signedAt: date("signed_at"),
  targetDate: date("target_date"),
  address: text("address"),
  scope: text("scope"),
  nextMilestone: text("next_milestone"),
  status: projectStatusEnum("status").notNull().default("active"),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  notes: text("notes"),
  depositPct: integer("deposit_pct").notNull().default(50),
  clientPortalEnabled: boolean("client_portal_enabled").notNull().default(true),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  hubspotDealId: text("hubspot_deal_id"),
  ...timestamps,
}, (t) => ({ stageIdx: index("projects_stage_idx").on(t.stageId) }));

export const projectActivity = pgTable("project_activity", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  body: text("body").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull().default("pending"),
  dueAt: date("due_at"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripeHostedUrl: text("stripe_hosted_url"),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  dueAt: date("due_at"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  sort: integer("sort").notNull().default(0),
  visibleToClient: boolean("visible_to_client").notNull().default(true),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  storageKey: text("storage_key"),
  type: text("type").notNull().default("other"), // agreement | proposal | answers | photo | invoice | other
  size: integer("size"),
  visibleToClient: boolean("visible_to_client").notNull().default(true),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: approvalStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  responseNote: text("response_note"),
});

export const portalAccess = pgTable("portal_access", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// CMS: pages, blocks, services, posts, RSS, products, testimonials, team, media
// ---------------------------------------------------------------------------
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // "/" | "/about" | "/services" ...
  key: text("key").notNull().unique(), // home | about | services | hhr | ...
  title: text("title").notNull(),
  navLabel: text("nav_label"), // utility-bar label
  status: contentStatusEnum("status").notNull().default("published"),
  heroStyle: heroStyleEnum("hero_style").notNull().default("cinematic"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  sort: integer("sort").notNull().default(0),
  parentKey: text("parent_key"),
  hasDraft: boolean("has_draft").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const pageBlocks = pgTable("page_blocks", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").references(() => pages.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  sort: integer("sort").notNull().default(0),
  content: jsonb("content").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  draftContent: jsonb("draft_content").$type<Record<string, unknown>>(),
  visible: boolean("visible").notNull().default(true),
  draftVisible: boolean("draft_visible"),
  ...timestamps,
}, (t) => ({ pageIdx: index("page_blocks_page_idx").on(t.pageId, t.sort) }));

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  kicker: text("kicker").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => services.id, { onDelete: "set null" }),
  sort: integer("sort").notNull().default(0),
  navGroup: text("nav_group").notNull().default("services"), // services | hhr | hidden
  heroStyle: heroStyleEnum("hero_style").notNull().default("cinematic"),
  cineLead: text("cine_lead"),
  cineTail: text("cine_tail"),
  scenesLabel: text("scenes_label"),
  scenes: jsonb("scenes").$type<{ name: string; word: string; line: string; img: string }[]>().notNull().default(sql`'[]'::jsonb`),
  slideSeconds: integer("slide_seconds").notNull().default(5),
  hero: text("hero").notNull(),
  sub: text("sub").notNull(),
  problem: text("problem").notNull(),
  empathy: text("empathy").notNull(),
  authority: text("authority").notNull(),
  plan: jsonb("plan").$type<[string, string][]>().notNull().default(sql`'[]'::jsonb`),
  success: jsonb("success").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  failure: text("failure").notNull(),
  features: jsonb("features").$type<[string, string][]>().notNull().default(sql`'[]'::jsonb`),
  tiers: jsonb("tiers").$type<[string, string, string][] | null>(),
  tiersTitle: text("tiers_title"),
  tiersSub: text("tiers_sub"),
  steps: jsonb("steps").$type<string[] | null>(),
  testimonialQuote: text("testimonial_quote"),
  testimonialWho: text("testimonial_who"),
  img: text("img").notNull(),
  img2: text("img2").notNull(),
  cta: text("cta").notNull(),
  beforeAfter: jsonb("before_after").$type<{ before: string; after: string; title: string } | null>(),
  pathId: text("path_id").references(() => paths.id, { onDelete: "set null" }),
  status: contentStatusEnum("status").notNull().default("published"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  ...timestamps,
});

export const rssSources = pgTable("rss_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  scope: text("scope").notNull().default("news"), // news | caribbean
  country: text("country"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  body: text("body"),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("Healthy Home Resources"),
  origin: text("origin").notNull().default("written"), // written | rss
  scope: text("scope").notNull().default("news"), // news | caribbean
  status: contentStatusEnum("status").notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  guid: text("guid").unique(),
  rssSourceId: integer("rss_source_id").references(() => rssSources.id, { onDelete: "set null" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  autoShared: boolean("auto_shared").notNull().default(false),
  ...timestamps,
}, (t) => ({ statusIdx: index("posts_status_idx").on(t.status, t.scope, t.publishedAt) }));

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  etsyUrl: text("etsy_url").notNull(),
  title: text("title").notNull(),
  price: text("price").notNull().default("$—"),
  imageUrl: text("image_url"),
  category: text("category").notNull().default("Uncategorized"),
  tag: text("tag"),
  reviews: text("reviews").notNull().default("(0)"),
  rating: text("rating").notNull().default("5.0"),
  type: text("type").notNull().default("Digital download"),
  featured: boolean("featured").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
});

export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  quote: text("quote").notNull(),
  who: text("who").notNull(),
  whereLabel: text("where_label").notNull(),
  serviceSlug: text("service_slug"),
  visible: boolean("visible").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  credentials: text("credentials"),
  quote: text("quote"),
  bio: text("bio"),
  bio2: text("bio2"),
  education: jsonb("education").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  credentialList: jsonb("credential_list").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  photoUrl: text("photo_url"),
  sort: integer("sort").notNull().default(0),
  visible: boolean("visible").notNull().default(true),
  ...timestamps,
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  storageKey: text("storage_key"),
  mime: text("mime"),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"),
  slot: text("slot").unique(), // stable slot key used by the site, e.g. "home.hero.residential"
  subject: text("subject"), // what the image should show (used for regeneration)
  aspect: text("aspect"),
  usedOn: text("used_on").array().notNull().default(sql`'{}'::text[]`),
  source: text("source").notNull().default("upload"), // upload | brand | magnific | stock | remote
  magnificCreationId: text("magnific_creation_id"),
  remoteUrl: text("remote_url"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Caribbean Connection
// ---------------------------------------------------------------------------
export const ccCountries = pgTable("cc_countries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  status: text("status").notNull().default("planned"), // live | next | planned
  sort: integer("sort").notNull().default(0),
});

export const ccResources = pgTable("cc_resources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  country: text("country").notNull().default("Jamaica"),
  area: text("area"),
  type: text("type"),
  url: text("url"),
  description: text("description").notNull(),
  status: moderationStatusEnum("status").notNull().default("pending"),
  kind: text("kind").notNull().default("suggestion"), // own | suggestion | curated
  submittedByName: text("submitted_by_name"),
  submittedByEmail: text("submitted_by_email"),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const ccEvents = pgTable("cc_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  timeLabel: text("time_label"),
  tz: text("tz").notNull().default("America/Jamaica"),
  whereLabel: text("where_label").notNull(),
  format: text("format").notNull().default("in_person"), // in_person | virtual | hybrid
  host: text("host").notNull(),
  url: text("url"),
  cost: text("cost").notNull().default("Free"),
  description: text("description").notNull(),
  country: text("country").notNull().default("Jamaica"),
  status: moderationStatusEnum("status").notNull().default("pending"),
  submittedByName: text("submitted_by_name"),
  submittedByEmail: text("submitted_by_email"),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
});

export const ccSubscribers = pgTable("cc_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  segment: text("segment").notNull(),
  location: text("location"),
  country: text("country"),
  consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("wellness"),
  consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Social (Phase 3)
// ---------------------------------------------------------------------------
export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  network: text("network").notNull().unique(), // facebook | instagram | linkedin | pinterest | youtube
  displayName: text("display_name"),
  externalId: text("external_id"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  status: text("status").notNull().default("disconnected"), // connected | disconnected | error
  followers: integer("followers"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps,
});

export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  networks: text("networks").array().notNull().default(sql`'{}'::text[]`),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: socialPostStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  results: jsonb("results").$type<Record<string, { id?: string; url?: string; error?: string; status: string }>>().notNull().default(sql`'{}'::jsonb`),
  metrics: jsonb("metrics").$type<Record<string, { impressions?: number; engagements?: number; clicks?: number }>>().notNull().default(sql`'{}'::jsonb`),
  originPostId: integer("origin_post_id").references(() => posts.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (t) => ({ schedIdx: index("social_posts_sched_idx").on(t.status, t.scheduledAt) }));

export const socialFeedItems = pgTable("social_feed_items", {
  id: serial("id").primaryKey(),
  network: text("network").notNull(),
  externalId: text("external_id").notNull().unique(),
  imageUrl: text("image_url"),
  permalink: text("permalink"),
  caption: text("caption"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Phase 4: follow-up & client ops
// ---------------------------------------------------------------------------
export const emailSequences = pgTable("email_sequences", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  triggerPathId: text("trigger_path_id").references(() => paths.id, { onDelete: "set null" }),
  triggerStage: leadStageEnum("trigger_stage"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const emailSequenceSteps = pgTable("email_sequence_steps", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").references(() => emailSequences.id, { onDelete: "cascade" }).notNull(),
  sort: integer("sort").notNull().default(0),
  delayHours: integer("delay_hours").notNull().default(24),
  channel: text("channel").notNull().default("email"), // email | sms
  subject: text("subject"),
  body: text("body").notNull(),
});

export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").references(() => emailSequences.id, { onDelete: "cascade" }).notNull(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  currentStep: integer("current_step").notNull().default(0),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ uniq: unique("sequence_enrollments_unique").on(t.sequenceId, t.leadId) }));

export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Follow-up"),
  body: text("body").notNull(),
  ...timestamps,
});

export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  status: proposalStatusEnum("status").notNull().default("draft"),
  token: text("token").notNull().unique(),
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signerName: text("signer_name"),
  signerIp: text("signer_ip"),
  signatureData: text("signature_data"),
  esignProvider: text("esign_provider"), // builtin | dropbox_sign | docusign
  esignRequestId: text("esign_request_id"),
  pdfUrl: text("pdf_url"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const hubspotSync = pgTable("hubspot_sync", {
  id: serial("id").primaryKey(),
  objectType: text("object_type").notNull(), // contact | deal
  objectId: integer("object_id").notNull(),
  hubspotId: text("hubspot_id"),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
}, (t) => ({ uniq: unique("hubspot_sync_unique").on(t.objectType, t.objectId) }));

// ---------------------------------------------------------------------------
// Messaging outbox, webhooks, cron
// ---------------------------------------------------------------------------
export const outbox = pgTable("outbox", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // email | sms
  toAddr: text("to_addr").notNull(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  attachments: jsonb("attachments").$type<{ filename: string; contentType: string; contentBase64?: string; url?: string }[]>(),
  status: outboxStatusEnum("status").notNull().default("queued"),
  provider: text("provider"),
  providerId: text("provider_id"),
  error: text("error"),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  attempts: integer("attempts").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ statusIdx: index("outbox_status_idx").on(t.status) }));

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").array().notNull().default(sql`'{}'::text[]`),
  secretEnc: text("secret_enc"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => webhookSubscriptions.id, { onDelete: "cascade" }).notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | delivered | failed
  responseStatus: integer("response_status"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  lastError: text("last_error"),
  ...timestamps,
}, (t) => ({ statusIdx: index("webhook_deliveries_status_idx").on(t.status, t.nextRetryAt) }));

export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // cft | stripe | esign | meta
  dedupeKey: text("dedupe_key").notNull().unique(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"), // received | processed | failed | ignored
  payload: jsonb("payload").$type<unknown>(),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const cronRuns = pgTable("cron_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  status: text("status").notNull().default("running"),
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadActivityRow = typeof leadActivity.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectPhase = typeof projectPhases.$inferSelect;
export type ProjectStage = typeof projectStages.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageBlock = typeof pageBlocks.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Media = typeof media.$inferSelect;
export type PathRow = typeof paths.$inferSelect;
export type FormField = typeof formFields.$inferSelect;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
export type CcResource = typeof ccResources.$inferSelect;
export type CcEvent = typeof ccEvents.$inferSelect;
export type CcSubscriber = typeof ccSubscribers.$inferSelect;
export type CcCountry = typeof ccCountries.$inferSelect;
export type RssSource = typeof rssSources.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type EmailSequence = typeof emailSequences.$inferSelect;
export type EmailSequenceStep = typeof emailSequenceSteps.$inferSelect;
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
