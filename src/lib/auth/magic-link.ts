import "server-only";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db, magicLinkTokens, users } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/server/crypto";
import { sendEmail } from "@/lib/server/outbox";

const TTL_MIN = 20;

/** Issue a magic link. Only existing, active users receive one (invite-only admin). */
export async function issueMagicLink(emailRaw: string, redirectTo = "/admin") {
  const email = emailRaw.trim().toLowerCase();
  const user = await db.query.users.findFirst({ where: and(eq(users.email, email), eq(users.isActive, true)) });
  // Always respond identically to avoid account enumeration.
  if (!user) return { ok: true as const, sent: false, devLink: null as string | null };
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL_MIN * 60000);
  await db.insert(magicLinkTokens).values({ email, tokenHash: sha256Hex(token), redirectTo, expiresAt });
  const link = `${env.baseUrl}/auth/verify#token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email, from: "noreply", subject: "Your Grace In Design sign-in link", relatedType: "user", relatedId: user.id, authExpiresAt: expiresAt,
    text: `Hi ${user.name.split(" ")[0]},\n\nClick to sign in to the Grace In Design admin:\n${link}\n\nThis link expires in ${TTL_MIN} minutes and can be used once. If you didn't request it, you can ignore this email.`,
  });
  return { ok: true as const, sent: true, devLink: env.isProd || env.sendgridApiKey ? null : link };
}

export async function consumeMagicLink(token: string) {
  const hash = sha256Hex(token);
  const now = new Date();
  // PostgreSQL rechecks this predicate after waiting for a concurrent update:
  // only the request that claims the unused token may create a session.
  const [row] = await db.update(magicLinkTokens).set({ usedAt: now })
    .where(and(eq(magicLinkTokens.tokenHash, hash), isNull(magicLinkTokens.usedAt), gt(magicLinkTokens.expiresAt, now)))
    .returning();
  if (!row) return null;
  const user = await db.query.users.findFirst({ where: and(eq(users.email, row.email), eq(users.isActive, true)) });
  if (!user) return null;
  return { user, redirectTo: row.redirectTo || "/admin" };
}
