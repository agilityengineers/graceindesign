/**
 * Call Flow Tracker master-dashboard SSO token (GID → CFT).
 *
 * CFT accepts `GET <CFT_URL>/sso/launch?token=<payloadB64>.<sig>` where
 *   sig = base64url(HMAC-SHA256(MASTER_DASHBOARD_SECRET, payloadB64))
 * and the payload carries aud (CFT's master app id), sub (a stable id CFT stores as
 * users.master_user_id), email (fallback identity on first launch), exp (≤ 16 min ahead), iat, jti.
 * Mirrors CFT's `server/masterDashboard.ts` verifier. Pure: no env, no DB — unit-tested.
 */
import crypto from "crypto";

export const CFT_LAUNCH_TOKEN_TTL_SEC = 2 * 60;
/** CFT refuses tokens that claim to live longer than ~16 minutes. */
export const CFT_MAX_TOKEN_LIFETIME_SEC = 15 * 60;

export type CftLaunchPayload = {
  aud: string; sub: string; email: string; name?: string; firstName?: string; lastName?: string; role?: string;
  iat: number; exp: number; jti: string;
};

export function b64urlEncode(buf: Buffer) { return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }
export function b64urlDecode(s: string) { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
function hmacB64url(secret: string, payload: string) { return b64urlEncode(crypto.createHmac("sha256", secret).update(payload).digest()); }
function timingEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

/** Stable `sub` for a GID person so CFT links them once and recognises them afterwards. */
export function cftSubjectFor(person: { id?: number | null; email: string }) {
  if (person.id) return `gid:user:${person.id}`;
  return `gid:email:${crypto.createHash("sha256").update(person.email.trim().toLowerCase()).digest("hex").slice(0, 32)}`;
}

export function signCftLaunchToken(opts: {
  secret: string; appId: string; sub: string; email: string; name?: string | null; role?: string | null; ttlSec?: number; now?: number;
}): { token: string; payload: CftLaunchPayload } {
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  const ttl = Math.min(opts.ttlSec ?? CFT_LAUNCH_TOKEN_TTL_SEC, CFT_MAX_TOKEN_LIFETIME_SEC);
  const name = (opts.name || "").trim();
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  const payload: CftLaunchPayload = {
    aud: opts.appId, sub: opts.sub, email: opts.email.trim().toLowerCase(),
    ...(name ? { name, firstName: firstName || "", lastName: rest.join(" ") } : {}),
    ...(opts.role ? { role: opts.role } : {}),
    iat: nowSec, exp: nowSec + ttl, jti: crypto.randomUUID(),
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  return { token: `${payloadB64}.${hmacB64url(opts.secret, payloadB64)}`, payload };
}

export type VerifyCftLaunchResult = { ok: true; payload: CftLaunchPayload } | { ok: false; reason: "bad_sig" | "wrong_aud" | "expired" | "missing_jti" };

/** The check CFT performs (minus the jti replay table), so tests prove what we mint is what it accepts. */
export function verifyCftLaunchToken(token: string, secret: string, appId: string, now = Date.now()): VerifyCftLaunchResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad_sig" };
  const [payloadB64, sig] = parts as [string, string];
  if (!timingEqual(hmacB64url(secret, payloadB64), sig)) return { ok: false, reason: "bad_sig" };
  let payload: CftLaunchPayload;
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")); } catch { return { ok: false, reason: "bad_sig" }; }
  const nowSec = Math.floor(now / 1000);
  if (payload.aud !== appId) return { ok: false, reason: "wrong_aud" };
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) return { ok: false, reason: "expired" };
  if (payload.exp - nowSec > CFT_MAX_TOKEN_LIFETIME_SEC + 60) return { ok: false, reason: "expired" };
  if (!payload.jti || typeof payload.jti !== "string") return { ok: false, reason: "missing_jti" };
  return { ok: true, payload };
}

/** Where to send the browser (or a server-side fetch with `returnJson`) so CFT signs the person in. */
export function cftLaunchUrl(cftUrl: string, token: string, returnJson = false) {
  return `${cftUrl.replace(/\/$/, "")}/sso/launch?token=${encodeURIComponent(token)}${returnJson ? "&return=json" : ""}`;
}
