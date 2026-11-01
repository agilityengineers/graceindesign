// server-only (also used by scripts/import-products.ts)
/**
 * Brings the seeded product list (src/lib/seed-data/products.ts) and the store-neutral AIP Products wording into an existing
 * database without touching anything edited in the admin. Used by Admin → Products ("Import the previous site's products") and
 * by `npm run content:products`. Idempotent: listings are matched by URL and only added when missing; page text changes only
 * where the earlier seeded wording is still in place.
 */
import { eq, sql } from "drizzle-orm";
import { db, products, pages, pageBlocks, integrations, media } from "@/lib/db";
import { PRODUCTS, productRow, type ProductSeed } from "@/lib/seed-data/products";
import { PAGES } from "@/lib/seed-data/pages";
import { fetchListing, refreshedFields } from "@/lib/server/listings";
import { putObject } from "@/lib/server/storage";
import { slugify } from "@/lib/utils";

export type ImportOptions = {
  /** Print every change, write nothing. */
  dryRun?: boolean;
  /** Copy each new listing's remote photo into the media store. */
  images?: boolean;
  /** Read price, photo and rating from the store page for each new listing. */
  refresh?: boolean;
  log?: (line: string) => void;
};
export type ImportResult = { added: number; alreadyPresent: number; changes: string[] };

// Earlier seeded wording (the prototype and the October 2026 launch patch). Replaced only where it still appears verbatim.
const OLD_HEADER_BODIES = [
  "Every product links to our Etsy shop, where checkout and delivery are handled securely.",
  "Every product links to our Etsy shop. Admins add new listings from the dashboard — paste the Etsy link and it appears here.",
];
const OLD_CARD_BODY = "Checklists, planners and essentials for Aging In Place — from our Etsy shop.";
const OLD_SEO = "Aging In Place checklists, planners and home-safety essentials from the Grace In Design Etsy shop.";
const OLD_CATEGORIES = ["All", "Assessments", "Bathroom", "Kitchen", "Workbooks", "Kits"];
const OLD_GRID_TITLES = ["All products"];

type Content = Record<string, unknown>;
type SeedPage = { key: string; seoDescription?: string; blocks: { type: string; content: Content }[] };
const SEED = PAGES as unknown as SeedPage[];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const seedPage = (key: string) => SEED.find((p) => p.key === key);
const seedBlock = (key: string, type: string): Content => seedPage(key)?.blocks.find((b) => b.type === type)?.content ?? {};

/** The new wording for one block, applied only to values that still carry the old wording. */
export function patchBlockContent(pageKey: string, type: string, c: Content): Content {
  const next = { ...c };
  if (pageKey === "aip-products" && type === "page_header") {
    const h = seedBlock("aip-products", "page_header");
    if (OLD_HEADER_BODIES.includes(String(c.body))) next.body = h.body;
    if (c.badge === "Sold on Etsy") { next.badge = h.badge; next.badgeDot = h.badgeDot; }
    if (!("badgeCount" in c)) next.badgeCount = "products";
  }
  if (pageKey === "aip-products" && type === "product_grid") {
    const g = seedBlock("aip-products", "product_grid");
    if (same(c.categories, OLD_CATEGORIES)) next.categories = [];
    if (OLD_GRID_TITLES.includes(String(c.title)) && g.title) next.title = g.title;
    if (!c.disclosure && g.disclosure) next.disclosure = g.disclosure;
  }
  if (pageKey === "hhr" && type === "hhr_cards" && Array.isArray(c.cards)) {
    const fresh = (seedBlock("hhr", "hhr_cards").cards as Content[] | undefined)?.find((x) => x.title === "AIP Products");
    next.cards = (c.cards as Content[]).map((card) => (card.title === "AIP Products" && card.body === OLD_CARD_BODY && fresh ? { ...card, body: fresh.body } : card));
  }
  return next;
}

/** Seeded listings that are not in the catalog yet (matched by URL). */
export async function missingSeedProducts(): Promise<ProductSeed[]> {
  const rows = await db.select({ url: products.url }).from(products);
  const have = new Set(rows.map((r) => r.url));
  return PRODUCTS.filter((p) => !have.has(p.url));
}

export async function importProducts(opts: ImportOptions = {}): Promise<ImportResult> {
  const { dryRun = false, images = false, refresh = false, log = () => {} } = opts;
  const changes: string[] = [];
  const note = (s: string) => { changes.push(s); log(`${dryRun ? "[dry-run] " : ""}${s}`); };
  const write = async (label: string, fn: () => Promise<unknown>) => { note(label); if (!dryRun) await fn(); };

  /** Copy a remote product photo into the media store so the site serves it itself. */
  async function selfHost(url: string, title: string): Promise<string | null> {
    try {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GraceInDesignBot/1.0)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const name = `${slugify(title).slice(0, 60) || "product"}.${ext}`;
      if (dryRun) return `/api/media/products/${name}`;
      const { url: served, key } = await putObject(`products/${name}`, buf);
      await db.insert(media).values({ name, url: served, storageKey: key, mime: ext === "jpg" ? "image/jpeg" : `image/${ext}`, size: buf.length, alt: title, usedOn: ["AIP Products"], source: "remote", remoteUrl: url });
      return served;
    } catch (e) { log(`  photo for "${title}" not copied: ${(e as Error).message}`); return null; }
  }

  // --- Listings -------------------------------------------------------------------------------------------------------------
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${products.sort}), -1)` }).from(products);
  let sort = Number(n), added = 0, alreadyPresent = 0;
  for (const p of PRODUCTS) {
    const existing = await db.query.products.findFirst({ where: eq(products.url, p.url) });
    if (existing) { alreadyPresent++; log(`products: "${existing.title}" is already in the catalog (#${existing.id})`); continue; }
    const base = productRow(p, ++sort);
    let details = { title: base.title, price: base.price, imageUrl: base.imageUrl, reviews: base.reviews, description: base.description, lastSyncedAt: null as Date | null };
    if (refresh) { const d = await fetchListing(base.url); if (d) details = refreshedFields(details, d); else log(`  ${base.retailer} didn't answer for "${base.title}" (seeded details kept)`); }
    if (images && details.imageUrl && /^https?:\/\//i.test(details.imageUrl)) { const hosted = await selfHost(details.imageUrl, details.title); if (hosted) details.imageUrl = hosted; }
    const row = { ...base, ...details };
    await write(`products: add "${row.title}" (${row.retailer}, ${row.category}${row.isActive ? "" : ", hidden"})`, () => db.insert(products).values(row));
    added++;
  }

  // --- Page copy --------------------------------------------------------------------------------------------------------------
  for (const key of ["aip-products", "hhr"]) {
    const page = await db.query.pages.findFirst({ where: eq(pages.key, key) });
    if (!page) { log(`pages.${key}: not found (skipped)`); continue; }
    const description = seedPage(key)?.seoDescription;
    if (key === "aip-products" && description && (!page.seoDescription || page.seoDescription === OLD_SEO)) {
      await write(`pages.${key}: seoDescription`, () => db.update(pages).set({ seoDescription: description, updatedAt: new Date() }).where(eq(pages.id, page.id)));
    }
    const blocks = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, page.id));
    for (const b of blocks) {
      const content = patchBlockContent(key, b.type, b.content as Content);
      const draft = b.draftContent ? patchBlockContent(key, b.type, b.draftContent as Content) : null;
      const set: { content?: Content; draftContent?: Content } = {};
      if (!same(content, b.content)) set.content = content;
      if (draft && !same(draft, b.draftContent)) set.draftContent = draft;
      if (Object.keys(set).length) await write(`page_blocks.${key}/${b.type}: ${Object.keys(set).join(", ")}`, () => db.update(pageBlocks).set({ ...set, updatedAt: new Date() }).where(eq(pageBlocks.id, b.id)));
    }
  }

  // --- Integrations panel -----------------------------------------------------------------------------------------------------
  const row = await db.query.integrations.findFirst({ where: eq(integrations.key, "amazon") });
  if (!row) await write("integrations: add the Amazon (Associates + Product Advertising API) entry", () => db.insert(integrations).values({ key: "amazon", name: "Amazon (Associates + Product Advertising API)", purpose: "Tracking id on product links, “Add to cart” buttons, live search and prices", phase: 2, status: "not_connected" }).onConflictDoNothing());

  return { added, alreadyPresent, changes };
}
