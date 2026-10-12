import { db, rateLimits } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

/** Simple DB-backed fixed-window rate limiter (works across Autoscale instances). */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<{ ok: boolean; remaining: number }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const [row] = await db.insert(rateLimits).values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN ${resetAt.toISOString()}::timestamptz ELSE ${rateLimits.resetAt} END`,
      },
    }).returning();
  if (row.count > max) return { ok: false, remaining: 0 };
  // best-effort cleanup
  if (Math.random() < 0.02) await db.delete(rateLimits).where(sql`${rateLimits.resetAt} < now() - interval '1 day'`).catch(() => {});
  return { ok: true, remaining: max - row.count };
}
export { eq };
