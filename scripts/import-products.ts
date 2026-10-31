/**
 * Product catalog import — adds the seeded listings (src/lib/seed-data/products.ts) to an ALREADY-SEEDED database, moves the
 * AIP Products page copy from "our Etsy shop" to store-neutral wording, and adds the WELLness-Products section (a `product_shelf`
 * block on the "wellness" shelf) to the bottom of Healthy Home Resources, without touching anything edited in the admin.
 *
 *   npm run content:products -- --dry-run     # print every change, write nothing
 *   npm run content:products                  # add missing listings + page copy
 *   npm run content:products -- --images      # also copy each new listing's remote photo into the media store (self-hosted)
 *   npm run content:products -- --refresh     # also read price, photo and rating from the store page for each new listing
 *
 * Run `npm run db:migrate` first (adds products.retailer, products.description and products.shelves). Safe to run repeatedly: listings
 * are matched by URL and only inserted when missing; page text changes only where the current value still equals the earlier seeded
 * wording; the WELLness-Products block is added once, and the shelf is stocked with the catalog's Amazon listings only while nothing is
 * on it yet (after that the admin decides). Run it once against the workspace database and once with DATABASE_URL pointed at
 * production (see docs/products.md).
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import * as S from "../src/lib/db/schema";
import { PRODUCTS, productRow } from "../src/lib/seed-data/products";
import { PAGES } from "../src/lib/seed-data/pages";
import { fetchListing, refreshedFields } from "../src/lib/server/listings";
import { putObject } from "../src/lib/server/storage";
import { slugify } from "../src/lib/utils";
import { WELLNESS_SHELF, onShelf, toggleShelf } from "../src/lib/shelves";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run"), IMAGES = args.includes("--images"), REFRESH = args.includes("--refresh");
const changes: string[] = [];
const note = (s: string) => { changes.push(s); console.log(`${DRY ? "[dry-run] " : ""}${s}`); };
async function write(label: string, fn: () => Promise<unknown>) { note(label); if (!DRY) await fn(); }

// Earlier seeded wording (the prototype and the October 2026 launch patch). Replaced only where it still appears verbatim.
const OLD_HEADER_BODIES = [
  "Every product links to our Etsy shop, where checkout and delivery are handled securely.",
  "Every product links to our Etsy shop. Admins add new listings from the dashboard — paste the Etsy link and it appears here.",
];
const OLD_CARD_BODY = "Checklists, planners and essentials for Aging In Place — from our Etsy shop.";
const OLD_SEO = "Aging In Place checklists, planners and home-safety essentials from the Grace In Design Etsy shop.";
const OLD_CATEGORIES = ["All", "Assessments", "Bathroom", "Kitchen", "Workbooks", "Kits"];

type Content = Record<string, unknown>;
type SeedPage = { key: string; seoDescription?: string; blocks: { type: string; content: Content }[] };
const SEED = PAGES as unknown as SeedPage[];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const seedPage = (key: string) => SEED.find((p) => p.key === key);
const seedBlock = (key: string, type: string): Content => seedPage(key)?.blocks.find((b) => b.type === type)?.content ?? {};

/** The new wording for one block, applied only to values that still carry the old wording. */
function patch(pageKey: string, type: string, c: Content): Content {
  const next = { ...c };
  if (pageKey === "aip-products" && type === "page_header") {
    const h = seedBlock("aip-products", "page_header");
    if (OLD_HEADER_BODIES.includes(String(c.body))) next.body = h.body;
    if (c.badge === "Sold on Etsy") { next.badge = h.badge; next.badgeDot = h.badgeDot; }
    if (!("badgeCount" in c)) next.badgeCount = "products";
  }
  if (pageKey === "aip-products" && type === "product_grid") {
    if (same(c.categories, OLD_CATEGORIES)) next.categories = [];
    if (!("disclosure" in c)) next.disclosure = "";
  }
  if (pageKey === "hhr" && type === "hhr_cards" && Array.isArray(c.cards)) {
    const fresh = (seedBlock("hhr", "hhr_cards").cards as Content[] | undefined)?.find((x) => x.title === "AIP Products");
    next.cards = (c.cards as Content[]).map((card) => (card.title === "AIP Products" && card.body === OLD_CARD_BODY && fresh ? { ...card, body: fresh.body } : card));
  }
  return next;
}

async function pages() {
  for (const key of ["aip-products", "hhr"]) {
    const page = await db.query.pages.findFirst({ where: eq(S.pages.key, key) });
    if (!page) { console.warn(`pages.${key}: not found (skipped)`); continue; }
    const description = seedPage(key)?.seoDescription;
    if (key === "aip-products" && description && (!page.seoDescription || page.seoDescription === OLD_SEO)) {
      await write(`pages.${key}: seoDescription`, () => db.update(S.pages).set({ seoDescription: description, updatedAt: new Date() }).where(eq(S.pages.id, page.id)));
    }
    const blocks = await db.select().from(S.pageBlocks).where(eq(S.pageBlocks.pageId, page.id));
    for (const b of blocks) {
      const content = patch(key, b.type, b.content as Content);
      const draft = b.draftContent ? patch(key, b.type, b.draftContent as Content) : null;
      const set: { content?: Content; draftContent?: Content } = {};
      if (!same(content, b.content)) set.content = content;
      if (draft && !same(draft, b.draftContent)) set.draftContent = draft;
      if (Object.keys(set).length) await write(`page_blocks.${key}/${b.type}: ${Object.keys(set).join(", ")}`, () => db.update(S.pageBlocks).set({ ...set, updatedAt: new Date() }).where(eq(S.pageBlocks.id, b.id)));
    }
  }
}

/** Copy a remote product photo into the media store so the site serves it itself. */
async function selfHost(url: string, title: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GraceInDesignBot/1.0)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const name = `${slugify(title).slice(0, 60) || "product"}.${ext}`;
    if (DRY) return `/api/media/products/${name}`;
    const { url: served, key } = await putObject(`products/${name}`, buf);
    await db.insert(S.media).values({ name, url: served, storageKey: key, mime: ext === "jpg" ? "image/jpeg" : `image/${ext}`, size: buf.length, alt: title, usedOn: ["AIP Products"], source: "remote", remoteUrl: url });
    return served;
  } catch (e) { console.warn(`  photo for "${title}" not copied: ${(e as Error).message}`); return null; }
}

async function listings() {
  const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${S.products.sort}), -1)` }).from(S.products);
  let sort = Number(n), added = 0;
  for (const p of PRODUCTS) {
    const existing = await db.query.products.findFirst({ where: eq(S.products.url, p.url) });
    if (existing) { console.log(`products: "${existing.title}" is already in the catalog (#${existing.id})`); continue; }
    const base = productRow(p, ++sort);
    let details = { title: base.title, price: base.price, imageUrl: base.imageUrl, reviews: base.reviews, description: base.description, lastSyncedAt: null as Date | null };
    if (REFRESH) { const d = await fetchListing(base.url); if (d) details = refreshedFields(details, d); else console.log(`  ${base.retailer} didn't answer for "${base.title}" (seeded details kept)`); }
    if (IMAGES && details.imageUrl && /^https?:\/\//i.test(details.imageUrl)) { const hosted = await selfHost(details.imageUrl, details.title); if (hosted) details.imageUrl = hosted; }
    const row = { ...base, ...details };
    await write(`products: add "${row.title}" (${row.retailer}, ${row.category}${row.isActive ? "" : ", hidden"})`, () => db.insert(S.products).values(row));
    added++;
  }
  return added;
}

/** The shelves column arrives with migration 0004; stop early with a clear message instead of a column-does-not-exist error. */
async function requireMigration() {
  const { rows } = await pool.query(`select 1 from information_schema.columns where table_name = 'products' and column_name = 'shelves'`);
  if (rows.length) return;
  console.error("products.shelves is missing — run `npm run db:migrate` first (migration 0004_product_shelves), then run this again.");
  await pool.end(); process.exit(1);
}
/** True when at least one listing sits on the shelf. */
async function shelfStocked(key: string) { const rows = await db.select({ shelves: S.products.shelves }).from(S.products); return rows.some((p) => onShelf(p.shelves, key)); }

/**
 * WELLness-Products: the product section at the bottom of Healthy Home Resources. Two parts: the `product_shelf` block on the page
 * (added once, after the page's last block) and the listings on the "wellness" shelf. `stock` is true when nothing was on the shelf
 * before this run; then every Amazon listing in the catalog goes on it so the section starts full. The admin takes over from there.
 */
async function wellnessShelf(stock: boolean) {
  const shelf = WELLNESS_SHELF;
  const page = await db.query.pages.findFirst({ where: eq(S.pages.key, shelf.pageKey) });
  if (!page) console.warn(`pages.${shelf.pageKey}: not found (${shelf.name} block skipped)`);
  else {
    const blocks = await db.select().from(S.pageBlocks).where(eq(S.pageBlocks.pageId, page.id));
    const isShelf = (c: unknown) => !!c && typeof c === "object" && (c as Content).shelf === shelf.key;
    if (blocks.some((b) => b.type === "product_shelf" && (isShelf(b.content) || isShelf(b.draftContent)))) console.log(`page_blocks.${shelf.pageKey}: ${shelf.name} is already on the page`);
    else {
      const seed = seedPage(shelf.pageKey)?.blocks.find((b) => b.type === "product_shelf" && isShelf(b.content));
      if (!seed) throw new Error(`seed page "${shelf.pageKey}" has no product_shelf block for the "${shelf.key}" shelf`);
      const sort = blocks.reduce((m, b) => Math.max(m, b.sort), -1) + 1;
      await write(`page_blocks.${shelf.pageKey}: add the ${shelf.name} section at the bottom of the page`, () => db.insert(S.pageBlocks).values({ pageId: page.id, type: "product_shelf", sort, content: seed.content, visible: true }));
    }
  }
  if (!stock) { console.log(`products: ${shelf.name} already has listings on it (left as the admin set it)`); return; }
  const rows = await db.select({ id: S.products.id, title: S.products.title, retailer: S.products.retailer, shelves: S.products.shelves }).from(S.products);
  const amazon = rows.filter((p) => p.retailer === "amazon" && !onShelf(p.shelves, shelf.key));
  if (!amazon.length) { console.log(`products: no Amazon listings to put on ${shelf.name} yet — add them in Admin → Products`); return; }
  for (const p of amazon) await write(`products: put "${p.title}" on ${shelf.name}`, () => db.update(S.products).set({ shelves: toggleShelf(p.shelves, shelf.key, true), updatedAt: new Date() }).where(eq(S.products.id, p.id)));
}

/** The Amazon row on the admin's Integrations panel (fresh seeds carry it; existing databases get it here). */
async function integrationRow() {
  const row = await db.query.integrations.findFirst({ where: eq(S.integrations.key, "amazon") });
  if (row) return;
  await write("integrations: add the Amazon (Associates + Product Advertising API) entry", () => db.insert(S.integrations).values({ key: "amazon", name: "Amazon (Associates + Product Advertising API)", purpose: "Tracking id on product links, “Add to cart” buttons, live search and prices", phase: 2, status: "not_connected" }).onConflictDoNothing());
}

async function main() {
  console.log(DRY ? "Dry run — nothing will be written.\n" : "Applying product catalog changes…\n");
  await requireMigration();
  const shelfWasEmpty = !(await shelfStocked(WELLNESS_SHELF.key)); // decided before new listings arrive (seeded Amazon picks start on the shelf)
  const added = await listings();
  await pages();
  await wellnessShelf(shelfWasEmpty);
  await integrationRow();
  console.log(`\n${changes.length} change(s) ${DRY ? "would be applied" : "applied"}; ${added} listing(s) ${DRY ? "to add" : "added"}.`);
  if (!DRY && changes.length) console.log(`Next: open Admin → Products to check photos, prices and descriptions, reorder or feature listings, and tick which ones belong on ${WELLNESS_SHELF.name} (${WELLNESS_SHELF.href}#${WELLNESS_SHELF.key}).`);
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
