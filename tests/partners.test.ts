import { test } from "node:test";
import assert from "node:assert/strict";
import { groupPartners, normalizePartnerUrl, partnerCategories, partnerInitials, partnerUrlLabel, PARTNERS_PAGE } from "../src/lib/partners";

test("categories follow the suggested order, then custom ones alphabetically, with Other last", () => {
  const rows = [{ category: "Other" }, { category: "Real estate" }, { category: "Pool safety" }, { category: "Occupational therapy" }, { category: "Arborists" }, { category: "Real estate" }];
  assert.deepEqual(partnerCategories(rows), ["Occupational therapy", "Real estate", "Arborists", "Pool safety", "Other"]);
});

test("grouping keeps the incoming order within a category and drops empty groups", () => {
  const rows = [{ id: 1, category: "Real estate" }, { id: 2, category: "Occupational therapy" }, { id: 3, category: "Real estate" }];
  assert.deepEqual(groupPartners(rows).map(([c, l]) => [c, l.map((r) => r.id)]), [["Occupational therapy", [2]], ["Real estate", [1, 3]]]);
  assert.deepEqual(groupPartners([]), []);
});

test("websites are normalised to safe absolute http(s) links", () => {
  assert.equal(normalizePartnerUrl("example.com"), "https://example.com/");
  assert.equal(normalizePartnerUrl("  www.example.com/about "), "https://www.example.com/about");
  assert.equal(normalizePartnerUrl("http://example.org"), "http://example.org/");
  assert.equal(normalizePartnerUrl("javascript:alert(1)"), "");
  assert.equal(normalizePartnerUrl("mailto:a@b.com"), "");
  assert.equal(normalizePartnerUrl("not a url"), "");
  assert.equal(normalizePartnerUrl(""), "");
  assert.equal(normalizePartnerUrl(null), "");
});

test("card helpers", () => {
  assert.equal(partnerUrlLabel("https://www.mobilityfirstot.com/"), "mobilityfirstot.com");
  assert.equal(partnerInitials("Mobility First OT"), "MF");
  assert.equal(partnerInitials("Smith & Sons"), "SS");
  assert.equal(partnerInitials("Ramps"), "RA");
});

test("the default page is a directory, not a recruiting page", () => {
  const text = JSON.stringify(PARTNERS_PAGE);
  assert.match(text, /partner_directory/);
  assert.doesNotMatch(text, /become a partner|join our/i);
  assert.equal(PARTNERS_PAGE.slug, "/healthy-home-resources/aip-partners");
});
