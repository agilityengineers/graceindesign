import { test } from "node:test";
import assert from "node:assert/strict";
import { SHELVES, SHELF_KEYS, AIP_SHELF, WELLNESS_SHELF, isShelfKey, parseShelves, toggleShelf, onShelf, shelfNames, shelfSection } from "../src/lib/shelves";
import { PRODUCTS, productRow, defaultShelves } from "../src/lib/seed-data/products";
import { PAGES } from "../src/lib/seed-data/pages";

test("the AIP Products and WELLness-Products shelves are registered and point at their pages", () => {
  assert.deepEqual(SHELF_KEYS, ["aip", "wellness"]);
  assert.equal(AIP_SHELF, SHELVES.aip);
  assert.equal(AIP_SHELF.name, "AIP Products");
  assert.equal(AIP_SHELF.pageKey, "aip-products");
  assert.equal(AIP_SHELF.href, "/healthy-home-resources/aip-products");
  assert.equal(WELLNESS_SHELF, SHELVES.wellness);
  assert.equal(WELLNESS_SHELF.name, "WELLness-Products");
  assert.equal(WELLNESS_SHELF.pageKey, "hhr");
  assert.equal(WELLNESS_SHELF.href, "/healthy-home-resources");
  assert.equal(isShelfKey("wellness"), true);
  assert.equal(isShelfKey("aip"), true);
  assert.equal(isShelfKey("Wellness"), false);
  assert.equal(isShelfKey(""), false);
});

test("form values become known shelf keys only, once each, in registry order", () => {
  assert.deepEqual(parseShelves(["wellness", "wellness"]), ["wellness"]);
  assert.deepEqual(parseShelves(["wellness", "aip"]), ["aip", "wellness"]); // registry order, whatever the form sent
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
  assert.deepEqual(toggleShelf(["wellness"], "aip", true), ["aip", "wellness"]);
  assert.deepEqual(toggleShelf(["aip", "wellness"], "aip", false), ["wellness"]);
  assert.equal(onShelf(["wellness"], "wellness"), true);
  assert.equal(onShelf(["wellness"], "aip"), false);
  assert.equal(onShelf([], "wellness"), false);
  assert.equal(onShelf(null, "wellness"), false);
  assert.deepEqual(shelfNames(["wellness", "aip"]), ["AIP Products", "WELLness-Products"]);
});

test("seeded listings start on AIP Products; Amazon picks also start on WELLness-Products", () => {
  assert.deepEqual(defaultShelves("amazon"), ["aip", "wellness"]);
  assert.deepEqual(defaultShelves("etsy"), ["aip"]);
  assert.deepEqual(defaultShelves("other"), ["aip"]);
  const rows = PRODUCTS.map((p, i) => productRow(p, i));
  const amazon = rows.filter((r) => r.retailer === "amazon");
  assert.ok(amazon.length >= 1);
  for (const r of amazon) assert.deepEqual(r.shelves, ["aip", "wellness"]);
  for (const r of rows.filter((r) => r.retailer !== "amazon")) assert.deepEqual(r.shelves, ["aip"]);
  assert.deepEqual(productRow({ url: "https://www.amazon.com/dp/B0CXYZ1234", title: "x", category: "y", shelves: [] }, 0).shelves, []);
});

test("the AIP Products seed shows the aip shelf in its carousel and grid", () => {
  const page = PAGES.find((p) => p.key === "aip-products");
  assert.ok(page);
  for (const type of ["product_carousel", "product_grid"]) {
    const block = page.blocks.find((b) => b.type === type);
    assert.ok(block, type);
    assert.equal(block.content.shelf, "aip");
  }
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

test("the ready-made shelf section is the seeded block, and every shelf has one for the Add block menu", () => {
  const hhr = PAGES.find((p) => p.key === "hhr");
  assert.ok(hhr);
  assert.deepEqual(hhr.blocks[hhr.blocks.length - 1].content, shelfSection("wellness"));
  for (const k of SHELF_KEYS) {
    const c = shelfSection(k);
    assert.equal(c.shelf, k);
    assert.equal(c.title, SHELVES[k].name);
    assert.equal(c.limit, 0);
    assert.equal(c.linkHref, AIP_SHELF.href);
    assert.ok(typeof c.body === "string" && c.body.length > 20);
  }
});
