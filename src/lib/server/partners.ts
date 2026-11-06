import "server-only";
import { eq } from "drizzle-orm";
import { db, pages, pageBlocks } from "@/lib/db";
import { PARTNERS_PAGE } from "@/lib/partners";

let ensured = false;
/**
 * AIP Partners used to render from the "aip-partners" service record (a sales landing with a consultation form). It now
 * renders from a CMS page. Databases seeded before that change have no such page, and publishing does not reseed, so the
 * first visit creates it with its default blocks. Idempotent: an existing page (edited, hidden or drafted) is left alone.
 */
export async function ensurePartnersPage(): Promise<void> {
  if (ensured) return;
  const existing = await db.query.pages.findFirst({ where: eq(pages.key, PARTNERS_PAGE.key), columns: { id: true } });
  if (!existing) {
    const { blocks, ...page } = PARTNERS_PAGE;
    const [created] = await db.insert(pages).values({ ...page, heroStyle: "classic", status: "published", sort: 4, publishedAt: new Date() }).onConflictDoNothing().returning({ id: pages.id });
    if (created) await db.insert(pageBlocks).values(blocks.map((b, i) => ({ pageId: created.id, type: b.type, sort: i, content: { ...b.content } as Record<string, unknown>, visible: true })));
  }
  ensured = true;
}
