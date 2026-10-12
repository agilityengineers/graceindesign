import "server-only";
/**
 * Call Flow Tracker → Connected Apps SSO (this app is the "child").
 * Contract: callflowtracker/docs/connected-apps.md
 *  - Launch token: <payloadB64>.<sig>, sig = base64url(HMAC-SHA256(secret, payloadB64))
 *  - Signed requests: x-master-timestamp + x-master-signature = base64url(HMAC(secret, `${appId}.${ts}.${sha256hex(body)}`))
 */
import { eq, lt } from "drizzle-orm";
import { db, ssoJtis, users, type UserRole } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacBase64Url, sha256Hex, timingSafeEqual } from "@/lib/server/crypto";
import { getSetting } from "@/lib/server/settings";

export type CftLaunchPayload = { aud: string; sub: string; email: string; name?: string; firstName?: string; lastName?: string; role: string; iat: number; exp: number; jti: string; target?: string };

function secrets() { return [env.cft.ssoSecret, env.cft.ssoSecretPrevious].filter(Boolean); }
export function ssoConfigured() { return secrets().length > 0; }

export function verifyLaunchToken(token: string): { ok: true; payload: CftLaunchPayload } | { ok: false; reason: string } {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return { ok: false, reason: "malformed" };
  const payloadB64 = token.slice(0, idx), sig = token.slice(idx + 1);
  const valid = secrets().some((s) => timingSafeEqual(sig, hmacBase64Url(s, payloadB64)));
  if (!valid) return { ok: false, reason: "signature" };
  let payload: CftLaunchPayload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")); } catch { return { ok: false, reason: "payload" }; }
  if (payload.aud !== env.cft.appId) return { ok: false, reason: "aud" };
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return { ok: false, reason: "expired" };
  if (!payload.jti || !payload.sub || !payload.email) return { ok: false, reason: "claims" };
  return { ok: true, payload };
}

/** Burn a jti; returns false if it was already used. */
export async function burnJti(jti: string, exp: number) {
  try {
    await db.insert(ssoJtis).values({ jti, expiresAt: new Date(exp * 1000) });
    if (Math.random() < 0.05) await db.delete(ssoJtis).where(lt(ssoJtis.expiresAt, new Date()));
    return true;
  } catch { return false; }
}

export function verifySignedRequest(headersIn: Headers, rawBody: string): { ok: boolean; reason?: string } {
  const ts = headersIn.get("x-master-timestamp");
  const sig = headersIn.get("x-master-signature");
  if (!ts || !sig) return { ok: false, reason: "missing headers" };
  const skew = Math.abs(Math.floor(Date.now() / 1000) - Number(ts));
  if (!isFinite(skew) || skew > 300) return { ok: false, reason: "timestamp" };
  const base = `${env.cft.appId}.${ts}.${sha256Hex(rawBody)}`;
  const valid = secrets().some((s) => timingSafeEqual(sig, hmacBase64Url(s, base)));
  return valid ? { ok: true } : { ok: false, reason: "signature" };
}

export async function mapCftRole(role: string): Promise<UserRole> {
  const map = await getSetting("cft_role_map");
  return (map[role] as UserRole) || "sales";
}

/** Create-or-link a local user for a CFT person. Links by cft_user_id first, then by email. */
export async function upsertCftUser(p: { masterUserId: string; email: string; firstName?: string; lastName?: string; name?: string; role: string; isActive?: boolean }) {
  const email = p.email.trim().toLowerCase();
  const name = p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || email;
  const role = await mapCftRole(p.role);
  const byCft = await db.query.users.findFirst({ where: eq(users.cftUserId, p.masterUserId) });
  if (byCft) {
    const [u] = await db.update(users).set({ email: byCft.email === email ? byCft.email : email, name, role: byCft.isSuperAdmin ? byCft.role : role, isActive: p.isActive ?? true, updatedAt: new Date() }).where(eq(users.id, byCft.id)).returning();
    return u;
  }
  const byEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (byEmail) {
    const [u] = await db.update(users).set({ cftUserId: p.masterUserId, isActive: p.isActive ?? byEmail.isActive, updatedAt: new Date() }).where(eq(users.id, byEmail.id)).returning();
    return u;
  }
  const [u] = await db.insert(users).values({ email, name, role, cftUserId: p.masterUserId, isActive: p.isActive ?? true, invitedAt: new Date() }).returning();
  return u;
}
