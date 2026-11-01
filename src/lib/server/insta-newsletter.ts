// server-only (also used by scripts/cron.ts)
/**
 * The hand-off from the website's sign-up forms to Insta-Newsletter, the newsletter system.
 *
 * Insta-Newsletter keeps the list of record, designs the newsletters and sends them. The website only
 * captures sign-ups (two public forms) and pushes each one through Insta-Newsletter's v1 API with a
 * long-lived API key cut for Grace's account (Settings → Developers there; instanewsletter
 * docs/api-v1.md). Each row in `cc_subscribers` / `newsletter_subscribers` remembers how its push went
 * (`insta_status`, src/lib/newsletter.ts) so Admin → Newsletter can show it and the `newsletter` cron
 * job can retry what did not get through.
 *
 * The key comes from Replit Secrets (INSTA_NEWSLETTER_URL + INSTA_NEWSLETTER_API_KEY) or, pasted in the
 * admin, from site_settings.newsletter encrypted with the session secret. Secrets win when both exist.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, ccSubscribers, newsletterSubscribers, integrations } from "@/lib/db";
import { env } from "@/lib/env";
import { getSetting, setSetting, type NewsletterSettings } from "@/lib/server/settings";
import { decrypt, encrypt } from "@/lib/server/crypto";
import {
  AUDIENCES, AUDIENCE_KEYS, type AudienceKey, type SubscriberRecord, type InstaOutcome,
  fromCaribbeanRow, fromHealthyHomeRow, buildInstaSubscriberBody, interpretSubscribeResponse, interpretUnsubscribeResponse,
  missingInstaScopes, needsPush, normalizeInstaUrl, looksLikeInstaApiKey, countryFromLocation,
} from "@/lib/newsletter";

export type InstaConnection = { url: string; apiKey: string; source: "secrets" | "admin" };
export type InstaMe = {
  account: { id: string; name: string };
  key: { id: string; name: string; keyPrefix: string; scopes: string[]; createdAt?: string; lastUsedAt?: string | null };
  plan: { name: string; contacts: { cap: number; used: number; remaining: number } };
  api: { version: string; baseUrl: string };
};
export type PushResult = InstaOutcome | { skipped: string };

export const INSTA_INTEGRATION = { key: "insta_newsletter", name: "Insta-Newsletter", purpose: "The newsletter system: audiences, newsletters and sends. Website sign-ups flow in through its API", phase: 2 } as const;

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** Where the key comes from today, if anywhere. */
export async function instaConnection(settings?: NewsletterSettings): Promise<{ conn: InstaConnection | null; settings: NewsletterSettings }> {
  const s = settings ?? (await getSetting("newsletter"));
  if (env.instaNewsletter.url && env.instaNewsletter.apiKey) return { conn: { url: env.instaNewsletter.url, apiKey: env.instaNewsletter.apiKey, source: "secrets" }, settings: s };
  const key = decrypt(s.instaApiKeyEnc);
  if (s.instaUrl && key) return { conn: { url: s.instaUrl, apiKey: key, source: "admin" }, settings: s };
  return { conn: null, settings: s };
}
export async function instaConfigured() { return Boolean((await instaConnection()).conn); }
/** For the Integrations card in Site settings. */
export async function instaLiveStatus(): Promise<"connected" | "not_connected"> { return (await instaConfigured()) ? "connected" : "not_connected"; }

type InstaResponse = { status: number; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
async function instaRequest(conn: InstaConnection, method: "GET" | "POST", path: string, body?: unknown): Promise<InstaResponse> {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(`${conn.url}/v1${path}`, {
      method, signal: ctrl.signal, cache: "no-store",
      headers: { authorization: `Bearer ${conn.apiKey}`, "content-type": "application/json", accept: "application/json", "user-agent": "GraceInDesign-website/1.0 (+https://graceindesign.net)" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json: unknown = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { error: text.slice(0, 200) || `HTTP ${r.status}`, code: "NOT_JSON" }; }
    return { status: r.status, body: json };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    return { status: 0, body: { error: err?.name === "AbortError" ? "Insta-Newsletter did not answer in time" : `Could not reach Insta-Newsletter: ${err?.message || String(e)}`, code: "NETWORK" } };
  } finally { clearTimeout(timer); }
}

/** An API failure in words the admin can act on. */
export function describeInstaError(r: InstaResponse): string {
  const code = typeof r.body?.code === "string" ? r.body.code : ""; const msg = typeof r.body?.error === "string" ? r.body.error : typeof r.body?.message === "string" ? r.body.message : "";
  switch (code) {
    case "INVALID_API_KEY": case "UNAUTHENTICATED": return "Insta-Newsletter does not recognise this API key. Mint one under Settings → Developers there and paste it again.";
    case "API_KEY_REVOKED": return "This API key was revoked in Insta-Newsletter. Mint a new one under Settings → Developers and paste it here.";
    case "API_NOT_IN_PLAN": return "API access is not part of this Insta-Newsletter plan. Upgrade the account, then check the connection again.";
    case "ACCOUNT_INACTIVE": return "The Insta-Newsletter account this key belongs to is not active.";
    case "INSUFFICIENT_SCOPE": return `The key is missing a scope: ${msg}`;
    case "RATE_LIMITED": return "Insta-Newsletter is rate limiting the website for a minute. Try again shortly.";
    case "NETWORK": return msg;
    default: return msg || (r.status ? `Insta-Newsletter answered HTTP ${r.status}` : "No answer from Insta-Newsletter");
  }
}

export async function checkInstaConnection(conn: InstaConnection): Promise<{ ok: true; me: InstaMe } | { ok: false; error: string }> {
  const r = await instaRequest(conn, "GET", "/me");
  if (r.status === 200 && r.body?.account && r.body?.key) return { ok: true, me: r.body as InstaMe };
  return { ok: false, error: describeInstaError(r) };
}

/** Find or create the two audiences the website feeds. Needs audiences:write to create; with audiences:read alone they must already exist by name. */
export async function ensureInstaAudiences(conn: InstaConnection, scopes: readonly string[]): Promise<{ ids: Partial<Record<AudienceKey, string>>; problems: string[] }> {
  const ids: Partial<Record<AudienceKey, string>> = {}; const problems: string[] = [];
  if (scopes.includes("audiences:write")) {
    for (const k of AUDIENCE_KEYS) {
      const a = AUDIENCES[k];
      const r = await instaRequest(conn, "POST", "/audiences", { name: a.name, description: a.description });
      if ((r.status === 200 || r.status === 201) && r.body?.audience?.id) ids[k] = String(r.body.audience.id);
      else problems.push(`Could not set up the "${a.name}" audience: ${describeInstaError(r)}`);
    }
    return { ids, problems };
  }
  const r = await instaRequest(conn, "GET", "/audiences");
  if (r.status !== 200) return { ids, problems: [`Could not list the account's audiences: ${describeInstaError(r)}`] };
  const items: { id: string; name: string }[] = Array.isArray(r.body?.items) ? r.body.items : [];
  for (const k of AUDIENCE_KEYS) {
    const hit = items.find((i) => String(i.name || "").trim().toLowerCase() === AUDIENCES[k].name.toLowerCase());
    if (hit) ids[k] = String(hit.id);
    else problems.push(`Create an audience named "${AUDIENCES[k].name}" in Insta-Newsletter (Contacts → Audiences), or mint a key with the audiences:write scope so the website can create it.`);
  }
  return { ids, problems };
}

/**
 * Connect, or re-check an existing connection: prove the key works, make sure it can write subscribers,
 * find or create the audiences, remember what the account looks like. Throws with a plain-language
 * message when the connection cannot be made.
 */
export async function connectInsta(input: { url?: string; apiKey?: string } = {}): Promise<{ settings: NewsletterSettings; me: InstaMe; problems: string[] }> {
  const current = await getSetting("newsletter");
  let conn: InstaConnection;
  if (env.instaNewsletter.url && env.instaNewsletter.apiKey) conn = { url: env.instaNewsletter.url, apiKey: env.instaNewsletter.apiKey, source: "secrets" };
  else {
    const url = normalizeInstaUrl(input.url || current.instaUrl);
    if (!url) throw new Error("Enter Insta-Newsletter's web address, e.g. https://insta-newsletter.com");
    const apiKey = (input.apiKey || "").trim() || decrypt(current.instaApiKeyEnc) || "";
    if (!apiKey) throw new Error("Paste the API key from Insta-Newsletter → Settings → Developers");
    if (!looksLikeInstaApiKey(apiKey)) throw new Error("That does not look like an Insta-Newsletter API key (they start with inl_)");
    conn = { url, apiKey, source: "admin" };
  }
  const check = await checkInstaConnection(conn);
  if (!check.ok) { await noteConnectionProblem(check.error); throw new Error(check.error); }
  const missing = missingInstaScopes(check.me.key.scopes || []);
  if (missing.length) throw new Error(`The key is missing the ${missing.join(" and ")} scope${missing.length > 1 ? "s" : ""}. In Insta-Newsletter → Settings → Developers, create a key with subscribers:write, audiences:read and audiences:write, then paste it here.`);
  const { ids, problems } = await ensureInstaAudiences(conn, check.me.key.scopes || []);
  const next: NewsletterSettings = {
    ...current,
    instaUrl: conn.source === "admin" ? conn.url : current.instaUrl,
    instaApiKeyEnc: conn.source === "admin" ? encrypt(conn.apiKey) : "",
    instaApiKeyPrefix: check.me.key.keyPrefix || conn.apiKey.slice(0, 12),
    audienceIds: { ...current.audienceIds, ...ids },
    instaAccountName: check.me.account.name || "",
    instaPlan: check.me.plan ? { name: check.me.plan.name, cap: check.me.plan.contacts?.cap ?? 0, used: check.me.plan.contacts?.used ?? 0, remaining: check.me.plan.contacts?.remaining ?? 0 } : null,
    connectedAt: current.connectedAt || new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    lastCheckError: problems[0] || null,
  };
  await setSetting("newsletter", next);
  await syncIntegrationStatus(problems.length ? "error" : "connected");
  return { settings: next, me: check.me, problems };
}

/** Forget the pasted key and what we learned about the account. A key set in Replit Secrets stays until it is removed there. */
export async function disconnectInsta() {
  const s = await getSetting("newsletter");
  await setSetting("newsletter", { ...s, instaApiKeyEnc: "", instaApiKeyPrefix: "", audienceIds: {}, instaAccountName: "", instaPlan: null, connectedAt: null, lastCheckedAt: null, lastCheckError: null });
  await syncIntegrationStatus((await instaConfigured()) ? "connected" : "not_connected");
}

async function noteConnectionProblem(error: string | null) {
  const s = await getSetting("newsletter");
  await setSetting("newsletter", { ...s, lastCheckedAt: new Date().toISOString(), lastCheckError: error });
  await syncIntegrationStatus("error");
}

/** The Integrations card in Site settings lists rows from the `integrations` table; make sure ours exists on databases seeded before it was added. */
export async function ensureInstaIntegrationRow() {
  await db.insert(integrations).values({ ...INSTA_INTEGRATION, status: "not_connected" }).onConflictDoNothing();
}
async function syncIntegrationStatus(status: "connected" | "not_connected" | "error") {
  await ensureInstaIntegrationRow();
  await db.update(integrations).set({ status, lastCheckedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.key, INSTA_INTEGRATION.key));
}

// ---------------------------------------------------------------------------
// Subscribers (both website lists)
// ---------------------------------------------------------------------------

export async function loadSubscribers(): Promise<SubscriberRecord[]> {
  const [cc, nl] = await Promise.all([
    db.select().from(ccSubscribers).orderBy(desc(ccSubscribers.createdAt)),
    db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.consentedAt)),
  ]);
  return [...cc.map(fromCaribbeanRow), ...nl.map(fromHealthyHomeRow)].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function loadSubscriber(audience: AudienceKey, id: number): Promise<SubscriberRecord | null> {
  if (audience === "caribbean-connection") { const r = await db.query.ccSubscribers.findFirst({ where: eq(ccSubscribers.id, id) }); return r ? fromCaribbeanRow(r) : null; }
  const r = await db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.id, id) }); return r ? fromHealthyHomeRow(r) : null;
}

type SyncPatch = { instaStatus: string | null; instaContactId?: string | null; instaSyncedAt?: Date | null; instaError: string | null };
async function saveSync(audience: AudienceKey, id: number, patch: SyncPatch) {
  if (audience === "caribbean-connection") await db.update(ccSubscribers).set(patch).where(eq(ccSubscribers.id, id));
  else await db.update(newsletterSubscribers).set(patch).where(eq(newsletterSubscribers.id, id));
}

export async function setSubscriberUnsubscribed(audience: AudienceKey, id: number, when: Date | null) {
  if (audience === "caribbean-connection") await db.update(ccSubscribers).set({ unsubscribedAt: when }).where(eq(ccSubscribers.id, id));
  else await db.update(newsletterSubscribers).set({ unsubscribedAt: when }).where(eq(newsletterSubscribers.id, id));
}

/** Remove the website's record only. The person stays in Insta-Newsletter unless they were unsubscribed first. */
export async function deleteSubscriber(audience: AudienceKey, id: number) {
  if (audience === "caribbean-connection") await db.delete(ccSubscribers).where(eq(ccSubscribers.id, id));
  else await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id));
}

/** Added by a team member in the admin: recorded like a form sign-up, pushed to Insta-Newsletter, no welcome email. */
export async function addManualSubscriber(input: { audience: AudienceKey; email: string; segment?: string | null; location?: string | null; by: string }): Promise<number> {
  const email = input.email.trim().toLowerCase();
  const sourcePage = `admin:${input.by}`;
  if (input.audience === "caribbean-connection") {
    const segment = input.segment || "A community organization or agency";
    const [row] = await db.insert(ccSubscribers).values({ email, segment, location: input.location || null, country: countryFromLocation(input.location), sourcePage })
      .onConflictDoUpdate({ target: ccSubscribers.email, set: { segment, location: input.location || null, country: countryFromLocation(input.location), unsubscribedAt: null } }).returning({ id: ccSubscribers.id });
    return row.id;
  }
  const [row] = await db.insert(newsletterSubscribers).values({ email, source: "admin", sourcePage })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { unsubscribedAt: null } }).returning({ id: newsletterSubscribers.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// The push
// ---------------------------------------------------------------------------

/**
 * Hand one active sign-up to Insta-Newsletter. Idempotent on the address, so retries are safe. Someone
 * who left Insta-Newsletter earlier and has now signed up again on the website is not re-added by the
 * website's say-so: Insta-Newsletter answers `suppressed`, and the website then asks it to email the
 * person a confirmation link instead (unless `allowConfirmation` is false, as on a cron retry).
 */
export async function pushSubscriber(audience: AudienceKey, id: number, opts: { allowConfirmation?: boolean } = {}): Promise<PushResult> {
  const { conn, settings } = await instaConnection();
  if (!conn) return { skipped: "Insta-Newsletter is not connected" };
  const rec = await loadSubscriber(audience, id);
  if (!rec) return { skipped: "No such subscriber" };
  if (rec.unsubscribedAt) return pushUnsubscribe(audience, id);
  const audienceId = settings.audienceIds[audience];
  if (!audienceId) {
    const error = `The "${AUDIENCES[audience].name}" audience is not set up in Insta-Newsletter yet. Open the Insta-Newsletter tab and check the connection.`;
    await saveSync(audience, id, { instaStatus: "failed", instaError: error });
    return { status: "failed", contactId: null, error, retry: false, connectionProblem: true };
  }
  const r = await instaRequest(conn, "POST", "/subscribers", buildInstaSubscriberBody(rec, audienceId, { doubleOptIn: settings.doubleOptIn, siteUrl: env.baseUrl }));
  let out = interpretSubscribeResponse(r.status, r.body);
  if (out.status === "suppressed" && !settings.doubleOptIn && opts.allowConfirmation !== false) {
    const r2 = await instaRequest(conn, "POST", "/subscribers", buildInstaSubscriberBody(rec, audienceId, { doubleOptIn: true, siteUrl: env.baseUrl }));
    const out2 = interpretSubscribeResponse(r2.status, r2.body);
    if (out2.status === "confirming") out = out2;
  }
  await saveSync(audience, id, { instaStatus: out.status, instaContactId: out.contactId ?? rec.instaContactId, instaSyncedAt: ["synced", "suppressed", "confirming"].includes(out.status) ? new Date() : rec.instaSyncedAt, instaError: out.error });
  if (out.connectionProblem) await noteConnectionProblem(out.error);
  return out;
}

/** Tell Insta-Newsletter the person unsubscribed on the website. A contact it never had counts as removed. */
export async function pushUnsubscribe(audience: AudienceKey, id: number): Promise<PushResult> {
  const { conn } = await instaConnection();
  if (!conn) return { skipped: "Insta-Newsletter is not connected" };
  const rec = await loadSubscriber(audience, id);
  if (!rec) return { skipped: "No such subscriber" };
  if (rec.instaStatus === null) return { skipped: "Never sent to Insta-Newsletter, nothing to remove" };
  const r = await instaRequest(conn, "POST", "/subscribers/unsubscribe", { email: rec.email });
  const out = interpretUnsubscribeResponse(r.status, r.body);
  await saveSync(audience, id, { instaStatus: out.status, instaContactId: out.contactId ?? rec.instaContactId, instaSyncedAt: out.status === "removed" ? new Date() : rec.instaSyncedAt, instaError: out.error });
  if (out.connectionProblem) await noteConnectionProblem(out.error);
  return out;
}

/** The public /unsubscribe page and the welcome-email link: stamp both website lists, then tell Insta-Newsletter. */
export async function unsubscribeEmailEverywhere(email: string): Promise<{ found: number }> {
  const e = email.trim().toLowerCase(); if (!e) return { found: 0 };
  const [cc, nl] = await Promise.all([
    db.select({ id: ccSubscribers.id }).from(ccSubscribers).where(eq(ccSubscribers.email, e)),
    db.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, e)),
  ]);
  const now = new Date();
  await Promise.all([
    db.update(ccSubscribers).set({ unsubscribedAt: now }).where(and(eq(ccSubscribers.email, e), isNull(ccSubscribers.unsubscribedAt))),
    db.update(newsletterSubscribers).set({ unsubscribedAt: now }).where(and(eq(newsletterSubscribers.email, e), isNull(newsletterSubscribers.unsubscribedAt))),
  ]);
  for (const r of cc) await pushUnsubscribe("caribbean-connection", r.id).catch(() => {});
  for (const r of nl) await pushUnsubscribe("healthy-home", r.id).catch(() => {});
  return { found: cc.length + nl.length };
}

/**
 * Cron `newsletter` and the admin's "Send everything waiting": bring Insta-Newsletter in line with the
 * website's lists. Active rows that never got there (or are waiting on a retry) are subscribed; rows the
 * person unsubscribed on the website but which are still active in Insta-Newsletter are unsubscribed.
 * Stops early when the connection itself is the problem, so one bad key does not burn through the list.
 */
export async function syncPendingSubscribers(limit = 50): Promise<{ skipped?: string; subscribed: number; unsubscribed: number; confirming: number; suppressed: number; queued: number; failed: number; remaining: number }> {
  const out = { subscribed: 0, unsubscribed: 0, confirming: 0, suppressed: 0, queued: 0, failed: 0, remaining: 0 };
  const { conn } = await instaConnection();
  if (!conn) return { skipped: "Insta-Newsletter is not connected", ...out };
  const all = await loadSubscribers();
  const todo = all.map((r) => [r, needsPush(r)] as const).filter((x): x is readonly [SubscriberRecord, "subscribe" | "unsubscribe"] => Boolean(x[1]));
  out.remaining = Math.max(0, todo.length - limit);
  const batch = todo.slice(0, limit);
  for (let i = 0; i < batch.length; i++) {
    const [r, what] = batch[i];
    const res = what === "subscribe" ? await pushSubscriber(r.audience, r.id, { allowConfirmation: false }) : await pushUnsubscribe(r.audience, r.id);
    if ("skipped" in res) continue;
    if (res.status === "synced") out.subscribed++; else if (res.status === "removed") out.unsubscribed++; else if (res.status === "confirming") out.confirming++; else if (res.status === "suppressed") out.suppressed++; else if (res.status === "queued") out.queued++; else if (res.status === "failed") out.failed++;
    if (res.connectionProblem) { out.remaining += batch.length - 1 - i; break; }
  }
  return out;
}

/** The welcome email the website sends on a Caribbean Connection sign-up: on unless the admin switched it off (e.g. because Insta-Newsletter's confirmation email covers it). */
export async function websiteWelcomeEmailEnabled() { return (await getSetting("newsletter")).sendWelcomeEmail; }
