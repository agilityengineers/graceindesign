import { test } from "node:test";
import assert from "node:assert/strict";
import { SHELVES, SHELF_KEYS, WELLNESS_SHELF, isShelfKey, parseShelves, toggleShelf, onShelf, shelfNames } from "../src/lib/shelves";
import { PRODUCTS, productRow, defaultShelves } from "../src/lib/seed-data/products";
import { PAGES } from "../src/lib/seed-data/pages";

test("the WELLness-Products shelf is registered and points at Healthy Home Resources", () => {
  assert.deepEqual(SHELF_KEYS, ["wellness"]);
  assert.equal(WELLNESS_SHELF, SHELVES.wellness);
  assert.equal(WELLNESS_SHELF.name, "WELLness-Products");
  assert.equal(WELLNESS_SHELF.pageKey, "hhr");
  assert.equal(WELLNESS_SHELF.href, "/healthy-home-resources");
  assert.equal(isShelfKey("wellness"), true);
  assert.equal(isShelfKey("Wellness"), false);
  assert.equal(isShelfKey(""), false);
});

test("form values become known shelf keys only, once each, in registry order", () => {
  assert.deepEqual(parseShelves(["wellness", "wellness"]), ["wellness"]);
  assert.deepEqual(parseShelves(["bogus", "", null, 3]), []);
  assert.deepEqual(parseShelves([]), []);
  assert.deepEqual(parseShelves(new FormData().getAll("shelves")), []);
});

test("putting a listing on a shelf and taking it off is explicit and idempotent", () => {
  assert.deepEqual(toggleShelf([], "wellness", true), ["wellness"]);
  assert.deepEqual(toggleShelf(["wellness"], "wellness", true), ["wellness"]);
  assert.deepEqual(toggleShelf(["wellness"], "wellness", false), []);
  assert.deepEqual(toggleShelf(null, "wellness", false), []);
  assert.deepEqual(toggleShelf(["wellness"], "wellness"), []); // no third argument flips it
  assert.deepEqual(toggleShelf(["stale-key", "wellness"], "wellness", true), ["wellness"]); // unknown keys are dropped
  assert.equal(onShelf(["wellness"], "wellness"), true);
  assert.equal(onShelf([], "wellness"), false);
  assert.equal(onShelf(null, "wellness"), false);
  assert.deepEqual(shelfNames(["wellness"]), ["WELLness-Products"]);
});

test("seeded Amazon picks start on WELLness-Products; other stores start on no shelf", () => {
  assert.deepEqual(defaultShelves("amazon"), ["wellness"]);
  assert.deepEqual(defaultShelves("etsy"), []);
  const rows = PRODUCTS.map((p, i) => productRow(p, i));
  const amazon = rows.filter((r) => r.retailer === "amazon");
  assert.ok(amazon.length >= 1);
  for (const r of amazon) assert.deepEqual(r.shelves, ["wellness"]);
  for (const r of rows.filter((r) => r.retailer !== "amazon")) assert.deepEqual(r.shelves, []);
  assert.deepEqual(productRow({ url: "https://www.amazon.com/dp/B0CXYZ1234", title: "x", category: "y", shelves: [] }, 0).shelves, []);
});

test("the Healthy Home Resources seed ends with the WELLness-Products section on the wellness shelf", () => {
  const hhr = PAGES.find((p) => p.key === "hhr");
  assert.ok(hhr);
  const last = hhr.blocks[hhr.blocks.length - 1];
  assert.equal(last.type, "product_shelf");
  assert.equal(last.content.shelf, "wellness");
  assert.equal(last.content.title, "WELLness-Products");
  assert.equal(last.content.limit, 0); // show everything the admin puts on the shelf
  assert.equal(last.content.linkHref, "/healthy-home-resources/aip-products");
  // The same block is what scripts/import-products.ts adds to an existing database, so there must be exactly one.
  assert.equal(hhr.blocks.filter((b) => b.type === "product_shelf" && b.content.shelf === "wellness").length, 1);
});
