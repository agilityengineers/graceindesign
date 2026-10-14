// server-only (also used by scripts/cron.ts)
/**
 * Auto sign-in links into Call Flow Tracker ("/go/cft/<token>").
 *
 * Think of one as a hotel key card: it opens one door (Grace's CFT account), it stops working after
 * a set time, and the front desk (this app) can cancel it. The card itself holds no secret that
 * CFT would accept — on each tap this app checks the card, then mints a fresh two-minute CFT token
 * and hands her through. That keeps the long-lived thing in the text message revocable here.
 */
import { and, eq, lt } from "drizzle-orm";
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
  hours?: number;
};

/** Mint a link. Returns null when CFT isn't configured at all (no CFT_URL). */
export async function createCftLaunchLink(opts: LaunchLinkOptions = {}): Promise<{ url: string; expiresAt: Date } | null> {
  if (!env.cft.url) return null;
  const person = opts.person === undefined ? await resolveNotificationUser() : opts.person;
  if (!person) return null;
  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + (opts.hours || env.cft.launchLinkHours) * 3600_000);
  await db.insert(cftLaunchLinks).values({ tokenHash: sha256Hex(token), userId: person.id ?? null, email: person.email.trim().toLowerCase(), target: opts.target || null, purpose: opts.purpose || "manual", relatedType: opts.relatedType, relatedId: opts.relatedId, expiresAt });
  if (Math.random() < 0.05) await db.delete(cftLaunchLinks).where(lt(cftLaunchLinks.expiresAt, new Date(Date.now() - 7 * 86400_000))).catch(() => {});
  return { url: `${env.baseUrl}/go/cft/${token}`, expiresAt };
}

export type ConsumeResult = { ok: true; redirectTo: string; person: CftPerson; target: string | null; sso: boolean } | { ok: false; reason: "invalid" | "expired" | "revoked" | "inactive" | "unconfigured" };

/** Validate a tapped link and build the CFT entry URL (a fresh SSO token each time). */
export async function consumeCftLaunchLink(token: string): Promise<ConsumeResult> {
  if (!token || token.length > 200) return { ok: false, reason: "invalid" };
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
  await db.update(cftLaunchLinks).set({ useCount: row.useCount + 1, lastUsedAt: new Date() }).where(eq(cftLaunchLinks.id, row.id));
  return { ok: true, redirectTo, person, target: row.target, sso: cftMasterConfigured() };
}

/** Cancel every outstanding link for a person (used when they are deactivated). */
export async function revokeCftLaunchLinks(userId: number) {
  await db.update(cftLaunchLinks).set({ revokedAt: new Date() }).where(and(eq(cftLaunchLinks.userId, userId))).catch(() => {});
}
