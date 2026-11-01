/**
 * Newsletter vocabulary shared by the admin, the public sign-up routes and the Insta-Newsletter push.
 * Client-safe: no database, no secrets.
 *
 * Picture the website as the front desk and Insta-Newsletter as the mailing room. The front desk takes
 * a visitor's address (the two sign-up forms), writes it in its own log (`cc_subscribers` and
 * `newsletter_subscribers`), and walks it straight through to the mailing room (Insta-Newsletter's v1
 * API, docs/insta-newsletter-integration.md). The mailing room keeps the list of record, designs the
 * newsletters and sends them. The log at the front desk remembers whether each hand-off succeeded, which
 * is what Admin → Newsletter shows.
 */

/** The two website lists and the Insta-Newsletter audience each one feeds. */
export const AUDIENCES = {
  "caribbean-connection": {
    key: "caribbean-connection",
    name: "Caribbean Connection",
    short: "Caribbean",
    description: "Signed up for the Caribbean Connection newsletter on graceindesign.net",
    signupPage: "/caribbean-connection",
    signupLabel: "Caribbean Connection page",
  },
  "healthy-home": {
    key: "healthy-home",
    name: "Healthy Home",
    short: "Healthy Home",
    description: "Requested the Healthy Home Walk-Through checklist on graceindesign.net",
    signupPage: "/healthy-home-resources/wellness",
    signupLabel: "Healthy Home checklist",
  },
} as const;
export type AudienceKey = keyof typeof AUDIENCES;
export const AUDIENCE_KEYS = Object.keys(AUDIENCES) as AudienceKey[];
export function isAudienceKey(v: unknown): v is AudienceKey { return typeof v === "string" && v in AUDIENCES; }

/** The "I am…" choices on the Caribbean Connection form (also the segment vocabulary in Insta-Newsletter custom fields). */
export const CARIBBEAN_SEGMENTS = ["Living in Jamaica", "In the diaspora, supporting family back home", "A caregiver or care professional", "A community organization or agency"] as const;

/**
 * How far a sign-up got on its way into Insta-Newsletter. `null` on the row means it has never been sent
 * (the person signed up before Insta-Newsletter was connected).
 */
export const INSTA_STATUSES = ["queued", "confirming", "synced", "suppressed", "removed", "failed"] as const;
export type InstaStatus = (typeof INSTA_STATUSES)[number];
export function isInstaStatus(v: unknown): v is InstaStatus { return typeof v === "string" && (INSTA_STATUSES as readonly string[]).includes(v); }

/** One subscriber as the admin sees them, whichever table they came from. */
export type SubscriberRecord = {
  id: number;
  audience: AudienceKey;
  email: string;
  segment: string | null;
  location: string | null;
  country: string | null;
  source: string;
  consentedAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
  instaStatus: InstaStatus | null;
  instaContactId: string | null;
  instaSyncedAt: Date | null;
  instaError: string | null;
  consentIp: string | null;
  sourcePage: string | null;
};

type SyncColumns = { instaStatus: string | null; instaContactId: string | null; instaSyncedAt: Date | null; instaError: string | null; consentIp: string | null; sourcePage: string | null };
export type CaribbeanRow = { id: number; email: string; segment: string; location: string | null; country: string | null; consentedAt: Date; unsubscribedAt: Date | null; createdAt: Date } & SyncColumns;
export type HealthyHomeRow = { id: number; email: string; source: string; consentedAt: Date; unsubscribedAt: Date | null } & SyncColumns;

const syncOf = (r: SyncColumns) => ({ instaStatus: isInstaStatus(r.instaStatus) ? r.instaStatus : null, instaContactId: r.instaContactId, instaSyncedAt: r.instaSyncedAt, instaError: r.instaError, consentIp: r.consentIp, sourcePage: r.sourcePage });

export function fromCaribbeanRow(r: CaribbeanRow): SubscriberRecord {
  return { id: r.id, audience: "caribbean-connection", email: r.email, segment: r.segment, location: r.location, country: r.country, source: "caribbean-newsletter", consentedAt: r.consentedAt, unsubscribedAt: r.unsubscribedAt, createdAt: r.createdAt, ...syncOf(r) };
}
export function fromHealthyHomeRow(r: HealthyHomeRow): SubscriberRecord {
  return { id: r.id, audience: "healthy-home", email: r.email, segment: null, location: null, country: null, source: r.source, consentedAt: r.consentedAt, unsubscribedAt: r.unsubscribedAt, createdAt: r.consentedAt, ...syncOf(r) };
}

/** Jamaica or the diaspora, from the free-text location the Caribbean form asks for. */
export function countryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  return /jamaica/i.test(location) ? "Jamaica" : "Diaspora";
}

// ---------------------------------------------------------------------------
// Insta-Newsletter v1 API (instanewsletter docs/api-v1.md)
// ---------------------------------------------------------------------------

export const INSTA_KEY_PREFIX = "inl_";
/** The scopes the website's key must carry, and the one that lets it create the two audiences itself. */
export const INSTA_REQUIRED_SCOPES = ["subscribers:write", "audiences:read"] as const;
export const INSTA_RECOMMENDED_SCOPES = ["audiences:write"] as const;
export const INSTA_TAG_MAX = 50;

export function looksLikeInstaApiKey(key: string): boolean { return /^inl_[A-Za-z0-9_-]{20,}$/.test(key.trim()); }

/** `https://host` from whatever was pasted: a bare host, a trailing slash, a `/v1` suffix or a deep link. `null` when it is not a usable address. */
export function normalizeInstaUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
    if (u.protocol === "http:" && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return null;
    return u.origin;
  } catch { return null; }
}

/** Deep links into Insta-Newsletter (its client routes). All empty until an address is known, so nothing renders a dangling relative link. */
export function instaLinks(baseUrl: string) {
  const b = (baseUrl || "").trim().replace(/\/+$/, "");
  if (!b) return { home: "", contacts: "", newsletters: "", campaigns: "", developers: "" };
  return { home: b, contacts: `${b}/contacts`, newsletters: `${b}/newsletters`, campaigns: `${b}/campaigns`, developers: `${b}/settings` };
}

export function missingInstaScopes(granted: readonly string[]): string[] { return INSTA_REQUIRED_SCOPES.filter((s) => !granted.includes(s)); }

/** The `POST /v1/subscribers` body for one website sign-up. Only fields the API knows: it refuses unknown ones. */
export function buildInstaSubscriberBody(rec: SubscriberRecord, audienceId: string, opts: { doubleOptIn: boolean; siteUrl: string }) {
  const a = AUDIENCES[rec.audience];
  const tags = Array.from(new Set(["website", a.key, ...(rec.segment ? [rec.segment] : [])])).map((t) => t.slice(0, INSTA_TAG_MAX));
  const customFields: Record<string, string> = { website_list: a.name, source: rec.source };
  if (rec.segment) customFields.segment = rec.segment;
  if (rec.location) customFields.location = rec.location;
  if (rec.country) customFields.country = rec.country;
  const consent: { at: string; ip?: string; page: string } = { at: rec.consentedAt.toISOString(), page: rec.sourcePage || `${opts.siteUrl.replace(/\/+$/, "")}${a.signupPage}` };
  if (rec.consentIp) consent.ip = rec.consentIp;
  return { email: rec.email, audienceIds: [audienceId], tags, customFields, consent, doubleOptIn: opts.doubleOptIn };
}

export type InstaOutcome = { status: InstaStatus; contactId: string | null; error: string | null; retry: boolean; connectionProblem: boolean };

const asError = (body: unknown) => {
  const b = (body || {}) as { error?: unknown; code?: unknown; message?: unknown };
  const msg = typeof b.error === "string" ? b.error : typeof b.message === "string" ? b.message : "";
  const code = typeof b.code === "string" ? b.code : "";
  return { msg, code };
};

/** What `POST /v1/subscribers` answered, in the status vocabulary the admin sees. */
export function interpretSubscribeResponse(httpStatus: number, body: unknown): InstaOutcome {
  const b = (body || {}) as { status?: string; subscriber?: { id?: string } };
  const contactId = b.subscriber?.id ?? null;
  if (httpStatus === 201 || (httpStatus === 200 && (b.status === "created" || b.status === "updated"))) return { status: "synced", contactId, error: null, retry: false, connectionProblem: false };
  if (httpStatus === 200 && b.status === "suppressed") return { status: "suppressed", contactId, error: null, retry: false, connectionProblem: false };
  if (httpStatus === 202) return { status: "confirming", contactId: null, error: null, retry: false, connectionProblem: false };
  const { msg, code } = asError(body);
  if (httpStatus === 0 || httpStatus >= 500 || httpStatus === 429 || httpStatus === 409) return { status: "queued", contactId: null, error: msg || `Insta-Newsletter answered ${httpStatus || "nothing"}; will retry`, retry: true, connectionProblem: false };
  if (httpStatus === 401 || (httpStatus === 403 && code !== "CONTACT_LIMIT_REACHED")) return { status: "queued", contactId: null, error: `Check the Insta-Newsletter connection: ${msg || code || httpStatus}`, retry: true, connectionProblem: true };
  if (code === "CONTACT_LIMIT_REACHED") return { status: "failed", contactId: null, error: msg || "The Insta-Newsletter plan has no room for another contact", retry: false, connectionProblem: false };
  if (code === "AUDIENCE_NOT_FOUND") return { status: "failed", contactId: null, error: "The audience no longer exists in Insta-Newsletter. Open the Insta-Newsletter tab and check the connection to recreate it.", retry: false, connectionProblem: true };
  return { status: "failed", contactId: null, error: msg || code || `Insta-Newsletter answered ${httpStatus}`, retry: false, connectionProblem: false };
}

/** What `POST /v1/subscribers/unsubscribe` answered. A contact Insta-Newsletter never had counts as removed. */
export function interpretUnsubscribeResponse(httpStatus: number, body: unknown): InstaOutcome {
  const b = (body || {}) as { subscriber?: { id?: string } };
  const contactId = b.subscriber?.id ?? null;
  if (httpStatus === 200 || httpStatus === 404) return { status: "removed", contactId, error: null, retry: false, connectionProblem: false };
  const { msg, code } = asError(body);
  if (httpStatus === 401 || httpStatus === 403) return { status: "queued", contactId: null, error: `Check the Insta-Newsletter connection: ${msg || code || httpStatus}`, retry: true, connectionProblem: true };
  if (httpStatus === 0 || httpStatus >= 500 || httpStatus === 429) return { status: "queued", contactId: null, error: msg || `Insta-Newsletter answered ${httpStatus || "nothing"}; will retry`, retry: true, connectionProblem: false };
  return { status: "failed", contactId: null, error: msg || code || `Insta-Newsletter answered ${httpStatus}`, retry: false, connectionProblem: false };
}

export type StatusTone = "ok" | "wait" | "bad" | "muted";
/** The sync status in words the admin can act on. */
export function describeInstaStatus(rec: Pick<SubscriberRecord, "instaStatus" | "unsubscribedAt" | "instaError">, connected: boolean): { label: string; tone: StatusTone; detail: string | null } {
  const s = rec.instaStatus;
  if (rec.unsubscribedAt) {
    if (s === "removed") return { label: "Removed from Insta-Newsletter", tone: "muted", detail: null };
    if (s === "suppressed") return { label: "Unsubscribed in Insta-Newsletter", tone: "muted", detail: null };
    if (s === "synced" || s === "confirming") return { label: connected ? "Removal pending" : "Still in Insta-Newsletter", tone: connected ? "wait" : "bad", detail: connected ? "Will be removed on the next sync" : "Connect Insta-Newsletter to remove them" };
    if (s === "queued") return { label: "Removal pending", tone: "wait", detail: rec.instaError };
    if (s === "failed") return { label: "Removal failed", tone: "bad", detail: rec.instaError };
    return { label: "Unsubscribed", tone: "muted", detail: "Never sent to Insta-Newsletter" };
  }
  if (!connected) return { label: s === "synced" ? "In Insta-Newsletter" : "Not sent yet", tone: s === "synced" ? "ok" : "muted", detail: s === "synced" ? null : "Connect Insta-Newsletter to send" };
  switch (s) {
    case "synced": return { label: "In Insta-Newsletter", tone: "ok", detail: null };
    case "confirming": return { label: "Awaiting their confirmation", tone: "wait", detail: "Insta-Newsletter emailed a confirmation link" };
    case "suppressed": return { label: "Unsubscribed in Insta-Newsletter", tone: "muted", detail: "They left earlier; only their own confirmation brings them back" };
    case "queued": return { label: "Retrying", tone: "wait", detail: rec.instaError };
    case "failed": return { label: "Failed", tone: "bad", detail: rec.instaError };
    case "removed":
    case null:
    default: return { label: "Not sent yet", tone: "wait", detail: "Goes on the next sync, or use Send now" };
  }
}

/** Whether a row still needs a push, given the state the website wants it in. */
export function needsPush(rec: Pick<SubscriberRecord, "instaStatus" | "unsubscribedAt">): "subscribe" | "unsubscribe" | null {
  const s = rec.instaStatus;
  if (rec.unsubscribedAt) return s === "synced" || s === "confirming" || s === "queued" ? "unsubscribe" : null;
  return s === null || s === "queued" || s === "removed" ? "subscribe" : null;
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

export type SubscriberFilter = { audience?: string | null; status?: string | null; q?: string | null };
export const STATUS_FILTERS = [["active", "Active"], ["attention", "Needs attention"], ["unsubscribed", "Unsubscribed"], ["all", "All"]] as const;

export function filterSubscribers(records: SubscriberRecord[], f: SubscriberFilter): SubscriberRecord[] {
  const audience = isAudienceKey(f.audience) ? f.audience : null;
  const status = f.status || "active";
  const q = (f.q || "").trim().toLowerCase();
  return records.filter((r) => {
    if (audience && r.audience !== audience) return false;
    if (status === "active" && r.unsubscribedAt) return false;
    if (status === "unsubscribed" && !r.unsubscribedAt) return false;
    if (status === "attention" && !(r.instaStatus === "failed" || r.instaStatus === "queued" || (!r.unsubscribedAt && r.instaStatus === null))) return false;
    if (q && !`${r.email} ${r.segment || ""} ${r.location || ""} ${r.country || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function summarizeSubscribers(records: SubscriberRecord[], now = new Date()) {
  const active = records.filter((r) => !r.unsubscribedAt);
  const since = new Date(now.getTime() - 30 * 86400000);
  return {
    active: active.length,
    byAudience: Object.fromEntries(AUDIENCE_KEYS.map((k) => [k, active.filter((r) => r.audience === k).length])) as Record<AudienceKey, number>,
    synced: active.filter((r) => r.instaStatus === "synced").length,
    confirming: active.filter((r) => r.instaStatus === "confirming").length,
    waiting: active.filter((r) => r.instaStatus === null || r.instaStatus === "queued" || r.instaStatus === "removed").length,
    failed: records.filter((r) => r.instaStatus === "failed").length,
    newLast30Days: records.filter((r) => r.createdAt >= since).length,
  };
}

const csvCell = (v: string | number | null | undefined) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/**
 * CSV in the shape Insta-Newsletter's Contacts → Import reads: `email`, `first_name`, `last_name` and `status`
 * are first-class there (an `unsubscribed` status keeps the suppression), every other column becomes a
 * custom field on the contact.
 */
export function subscribersCsv(records: SubscriberRecord[]): string {
  const header = ["email", "first_name", "last_name", "status", "audience", "segment", "location", "country", "source", "consented_at", "unsubscribed_at", "insta_newsletter"];
  const rows = records.map((r) => [r.email, "", "", r.unsubscribedAt ? "unsubscribed" : "active", AUDIENCES[r.audience].name, r.segment, r.location, r.country, r.source, r.consentedAt.toISOString(), r.unsubscribedAt?.toISOString() ?? "", r.instaStatus ?? "not sent"]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
