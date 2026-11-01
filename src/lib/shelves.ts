/**
 * Named product shelves. A shelf is a curated set of catalog listings that a page section shows; think of the catalog as the
 * stockroom and each shelf as one display table the admin stocks from it. Membership lives in `products.shelves` (one listing
 * can sit on several shelves), the admin ticks shelves under "Shows on" in Admin → Products, and the block that shows a shelf
 * carries `shelf: "<key>"` (the AIP Products grid and carousel, the WELLness-Products `product_shelf` block).
 * Client-safe: no database, no network.
 */
export type ShelfKey = "aip" | "wellness";
export type Shelf = { key: ShelfKey; name: string; pageKey: string; pageTitle: string; href: string; where: string; whenEmpty: string };

export const SHELVES: Record<ShelfKey, Shelf> = {
  aip: { key: "aip", name: "AIP Products", pageKey: "aip-products", pageTitle: "AIP Products", href: "/healthy-home-resources/aip-products", where: "the AIP Products page", whenEmpty: "the page shows its empty message" },
  wellness: { key: "wellness", name: "WELLness-Products", pageKey: "hhr", pageTitle: "Healthy Home Resources", href: "/healthy-home-resources", where: "the bottom of Healthy Home Resources", whenEmpty: "the section stays hidden" },
};
export const SHELF_KEYS = Object.keys(SHELVES) as ShelfKey[];
export const AIP_SHELF = SHELVES.aip;
export const WELLNESS_SHELF = SHELVES.wellness;

export function isShelfKey(v: unknown): v is ShelfKey { return typeof v === "string" && (SHELF_KEYS as string[]).includes(v); }

/** Known shelf keys from form values (checkboxes named `shelves`), deduplicated and in registry order. Unknown values are dropped. */
export function parseShelves(values: Iterable<unknown>): ShelfKey[] {
  const picked = new Set<string>();
  for (const v of values) if (isShelfKey(v)) picked.add(v);
  return SHELF_KEYS.filter((k) => picked.has(k));
}

export function onShelf(shelves: readonly string[] | null | undefined, key: string) { return Array.isArray(shelves) && shelves.includes(key); }

/** The listing's shelves with `key` added (on = true), removed (on = false) or flipped (on omitted); always canonical order, never duplicates. */
export function toggleShelf(shelves: readonly string[] | null | undefined, key: ShelfKey, on?: boolean): ShelfKey[] {
  const next = new Set(parseShelves(shelves ?? []));
  const want = on ?? !next.has(key);
  if (want) next.add(key); else next.delete(key);
  return SHELF_KEYS.filter((k) => next.has(k));
}

/** Display names of the shelves a listing sits on, e.g. ["AIP Products", "WELLness-Products"]. */
export function shelfNames(shelves: readonly string[] | null | undefined) { return parseShelves(shelves ?? []).map((k) => SHELVES[k].name); }
