import { and, eq, isNotNull, or, sql, desc } from "drizzle-orm";
import { db, outbox } from "@/lib/db";

export const clearedAuthContent = { bodyText: null, bodyHtml: null, attachments: null };

/** Use before retries and admin reads; also removes historical terminal bodies. */
export async function purgeAuthOutboxBodies() {
  // Legacy path-token messages cannot be redeemed; remove their saved copies.
  await db.update(outbox).set({ ...clearedAuthContent, error: null, authExpiresAt: new Date(0) })
    .where(sql`${outbox.bodyText} like '%/go/cft/%' or ${outbox.bodyHtml} like '%/go/cft/%'`);
  await db.update(outbox).set(clearedAuthContent).where(and(
    isNotNull(outbox.authExpiresAt),
    or(sql`${outbox.authExpiresAt} <= now()`, sql`${outbox.attempts} >= 3`,
      eq(outbox.status, "sent"), eq(outbox.status, "logged")),
    or(isNotNull(outbox.bodyText), isNotNull(outbox.bodyHtml), isNotNull(outbox.attachments)),
  ));
}

/** Never select credential bodies or provider errors for admin previews. */
export async function readOutboxPreviews() {
  await purgeAuthOutboxBodies();
  return db.select({
    id: outbox.id, channel: outbox.channel, toAddr: outbox.toAddr, fromAddr: outbox.fromAddr,
    subject: outbox.subject, status: outbox.status, createdAt: outbox.createdAt,
    authExpiresAt: outbox.authExpiresAt, attempts: outbox.attempts,
    bodyText: sql<string | null>`case when ${outbox.authExpiresAt} is not null then '[Sign-in content hidden]' else ${outbox.bodyText} end`,
    error: sql<string | null>`case when ${outbox.authExpiresAt} is not null then null else ${outbox.error} end`,
  }).from(outbox).orderBy(desc(outbox.createdAt)).limit(150);
}
