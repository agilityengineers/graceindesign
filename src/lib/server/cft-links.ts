// server-only (also used by scripts/cron.ts)
/**
 * Single-use auto sign-in links into Call Flow Tracker ("/go/cft#token=…").
 *
 * A 20-minute, single-use credential is exchanged through a browser POST.
 * After an atomic claim, this app hands off a short-lived token under CFT's
 * existing SSO contract. Never return the message credential in notification results.
 */
import { and, eq, lt, gt, isNull } from "drizzle-orm";
import { db, cftLaunchLinks, users } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import { buildCftEntryUrl, cftMasterConfigured, resolveNotificationUser, type CftPerson } from "@/lib/server/cft-master";

export type LaunchLinkOptions = {
  /** Who the link signs in. Defaults to the configured notification user (Grace). */
  person?: CftPerson | null;
  /** CFT path hint, e.g. "/calls" or "/messages" (CFT currently lands on its dashboard after SSO). */
  target?: string | null;
  purpose?: "lead" | "cc_submission" | "subscriber" | "cft_call" | "manual";
  relatedType?: string; relatedId?: number;
};

/** Mint a link. Returns null when CFT isn't configured at all (no CFT_URL). */
export async function createCftLaunchLink(opts: LaunchLinkOptions = {}): Promise<{ url: string; expiresAt: Date } | null> {
  if (!env.cft.url) return null;
  const person = opts.person === undefined ? await resolveNotificationUser() : opts.person;
  if (!person) return null;
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 20 * 60_000);
  await db.insert(cftLaunchLinks).values({ tokenHash: sha256Hex(token), userId: person.id ?? null, email: person.email.trim().toLowerCase(), target: opts.target || null, purpose: opts.purpose || "manual", relatedType: opts.relatedType, relatedId: opts.relatedId, expiresAt });
  if (Math.random() < 0.05) await db.delete(cftLaunchLinks).where(lt(cftLaunchLinks.expiresAt, new Date(Date.now() - 7 * 86400_000))).catch(() => {});
  return { url: `${env.baseUrl}/go/cft#token=${token}`, expiresAt };
}

export type ConsumeResult = { ok: true; redirectTo: string; person: CftPerson; target: string | null; sso: boolean } | { ok: false; reason: "invalid" | "expired" | "revoked" | "inactive" | "unconfigured" };

/** Atomically consume a tapped link and return a short-lived CFT SSO destination. */
export async function consumeCftLaunchLink(token: string): Promise<ConsumeResult> {
  // Old path-bearing tokens had 32 characters; never redeem them again.
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };
  const row = await db.query.cftLaunchLinks.findFirst({ where: eq(cftLaunchLinks.tokenHash, sha256Hex(token)) });
  if (!row) return { ok: false, reason: "invalid" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  let person: CftPerson = { email: row.email, name: null };
  if (row.userId) {
    const u = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!u || !u.isActive) return { ok: false, reason: "inactive" };
    person = { id: u.id, email: u.email, name: u.name };
  }
  const redirectTo = buildCftEntryUrl(person);
  if (!redirectTo) return { ok: false, reason: "unconfigured" };
  const now = new Date();
  const claimed = await db.update(cftLaunchLinks).set({ useCount: 1, lastUsedAt: now, revokedAt: now })
    .where(and(eq(cftLaunchLinks.id, row.id), isNull(cftLaunchLinks.revokedAt), gt(cftLaunchLinks.expiresAt, now)))
    .returning({ id: cftLaunchLinks.id });
  if (!claimed.length) return { ok: false, reason: "revoked" };
  return { ok: true, redirectTo, person, target: row.target, sso: cftMasterConfigured() };
}

/** Cancel every outstanding link for a person (used when they are deactivated). */
export async function revokeCftLaunchLinks(userId: number) {
  await db.update(cftLaunchLinks).set({ revokedAt: new Date() }).where(and(eq(cftLaunchLinks.userId, userId))).catch(() => {});
}
