// server-only (also used by scripts/cron.ts)
/**
 * GID → Call Flow Tracker. Two things live here:
 *
 *  1. Signing people INTO CFT. CFT already accepts "master dashboard" SSO tokens at `/sso/launch`
 *     (docs/master-dashboard-sso.md in the CFT repo). With CFT's MASTER_DASHBOARD_SECRET in
 *     CFT_MASTER_DASHBOARD_SECRET, this app can mint a two-minute token for a team member and
 *     redirect them straight into CFT — no password prompt.
 *
 *  2. Sending team texts THROUGH CFT. CFT owns the Twilio account and Grace's tracking number.
 *     We mint the same kind of token for the sending user, exchange it server-side for a CFT
 *     session (`/sso/launch?…&return=json`), then call CFT's `POST /api/messages/send` with that
 *     session, so the text goes out from her CFT number and the thread shows up in CFT's inbox.
 *
 * Everything is inert until CFT_URL + CFT_MASTER_DASHBOARD_SECRET exist.
 */
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/lib/db";
import { env } from "@/lib/env";
import { cftLaunchUrl, cftSubjectFor, signCftLaunchToken } from "@/lib/cft-launch-token";
import { getSetting } from "@/lib/server/settings";
import { normalizePhone } from "@/lib/server/outbox-phone";

const FETCH_TIMEOUT_MS = 10_000;
/** CFT sessions last 24h; keep ours well inside that and re-mint on 401 anyway. */
const SESSION_CACHE_MS = 20 * 3600_000;

export function cftMasterConfigured() { return Boolean(env.cft.url && env.cft.masterSecret); }

export type CftPerson = { id?: number | null; email: string; name?: string | null };

/** Build the URL that signs `person` into CFT. Falls back to CFT's login page when SSO isn't configured. */
export function buildCftEntryUrl(person: CftPerson | null, opts: { returnJson?: boolean } = {}) {
  if (!env.cft.url) return null;
  if (!person || !cftMasterConfigured()) return `${env.cft.url}/login`;
  const { token } = signCftLaunchToken({ secret: env.cft.masterSecret, appId: env.cft.masterAppId, sub: cftSubjectFor(person), email: person.email, name: person.name, role: "admin" });
  return cftLaunchUrl(env.cft.url, token, opts.returnJson);
}

/** Resolve the team member notifications and auto sign-in links are for (Grace by default). */
export async function resolveNotificationUser(): Promise<CftPerson | null> {
  const n = await getSetting("notifications");
  const email = (n.cftUserEmail || "").trim().toLowerCase();
  if (email) {
    const u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (u && !u.isActive) return null;
    return u ? { id: u.id, email: u.email, name: u.name } : { email, name: null };
  }
  // No explicit choice: the first active owner that isn't a placeholder.
  const owner = await db.query.users.findFirst({ where: eq(users.role, "owner"), orderBy: (t, { asc }) => [asc(t.id)] });
  return owner && owner.isActive ? { id: owner.id, email: owner.email, name: owner.name } : null;
}

export function personFromUser(u: Pick<User, "id" | "email" | "name">): CftPerson { return { id: u.id, email: u.email, name: u.name }; }

// ---- Sessions for server-to-server calls ----------------------------------------------------
const sessionCache = new Map<string, { sessionId: string; expiresAt: number }>();

async function fetchJson(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: "manual" });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, ok: res.ok, body };
  } finally { clearTimeout(t); }
}

/** A CFT session for `person`, minted through master SSO and cached. */
export async function getCftSession(person: CftPerson, opts: { fresh?: boolean } = {}): Promise<string> {
  if (!cftMasterConfigured()) throw new Error("Call Flow Tracker SSO is not configured (CFT_URL, CFT_MASTER_DASHBOARD_SECRET)");
  const key = person.email.trim().toLowerCase();
  const cached = sessionCache.get(key);
  if (!opts.fresh && cached && cached.expiresAt > Date.now()) return cached.sessionId;
  const url = buildCftEntryUrl(person, { returnJson: true })!;
  const r = await fetchJson(url, { headers: { accept: "application/json" } });
  if (!r.ok || !r.body?.sessionId) {
    const why = r.status === 401 ? "CFT refused the SSO token (is this email a CFT user, and does CFT_MASTER_DASHBOARD_SECRET match CFT's MASTER_DASHBOARD_SECRET?)" : r.status === 503 ? "CFT has no MASTER_DASHBOARD_SECRET set" : `HTTP ${r.status}`;
    throw new Error(`Call Flow Tracker sign-in failed: ${why}`);
  }
  sessionCache.set(key, { sessionId: String(r.body.sessionId), expiresAt: Date.now() + SESSION_CACHE_MS });
  return String(r.body.sessionId);
}

// ---- SMS through CFT ---------------------------------------------------------------------------
export async function resolveCftSmsSender(): Promise<CftPerson | null> {
  // An explicit sender is matched in CFT by email alone — no GID account needed.
  if (env.cft.smsSenderEmail) return { email: env.cft.smsSenderEmail, name: null };
  return resolveNotificationUser();
}

/** True when texts can go out through CFT (URL + secret + a tracking number to send from). */
export function cftSmsConfigured() { return cftMasterConfigured() && Boolean(normalizePhone(env.cft.smsFrom)); }

export async function sendSmsViaCft(opts: { to: string; body: string; mediaUrls?: string[] }): Promise<{ messageSid: string; status: string; from: string }> {
  if (!cftSmsConfigured()) throw new Error("Call Flow Tracker SMS is not configured (CFT_SMS_FROM)");
  const sender = await resolveCftSmsSender();
  if (!sender) throw new Error("No Call Flow Tracker user to send texts as (set CFT_SMS_SENDER_EMAIL or the notification user)");
  const from = normalizePhone(env.cft.smsFrom)!;
  const to = normalizePhone(opts.to);
  if (!to) throw new Error("Invalid recipient number");
  const attempt = async (fresh: boolean) => {
    const sessionId = await getCftSession(sender, { fresh });
    return fetchJson(`${env.cft.url}/api/messages/send`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${sessionId}` },
      body: JSON.stringify({ from, to, body: opts.body, ...(opts.mediaUrls?.length ? { mediaUrls: opts.mediaUrls } : {}) }),
    });
  };
  let r = await attempt(false);
  if (r.status === 401) r = await attempt(true); // cached session expired or was revoked
  if (!r.ok) throw new Error(`Call Flow Tracker SMS failed: ${r.body?.error || `HTTP ${r.status}`}`);
  return { messageSid: String(r.body?.messageSid || r.body?.message?.messageSid || ""), status: String(r.body?.message?.status || "queued"), from };
}

/** Admin "Re-check" helper: can we obtain a session for the notification user? */
export async function testCftConnection(): Promise<{ ok: boolean; detail: string }> {
  if (!cftMasterConfigured()) return { ok: false, detail: "CFT_URL and CFT_MASTER_DASHBOARD_SECRET are not both set" };
  const person = await resolveCftSmsSender();
  if (!person) return { ok: false, detail: "No team member configured for Call Flow Tracker notifications" };
  try { await getCftSession(person, { fresh: true }); return { ok: true, detail: `Signed ${person.email} into Call Flow Tracker` }; }
  catch (e: any) { return { ok: false, detail: String(e?.message || e) }; }
}
