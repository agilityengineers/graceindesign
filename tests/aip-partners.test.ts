import { test } from "node:test";
import assert from "node:assert/strict";
import { AIP_PARTNER_CATEGORIES, aipPartnerCategoryLabel, aipPartnerRelationshipLabel, isAipPartnerCategory, isAipPartnerRelationship, normalizeWebsite, partnerImageKind } from "../src/lib/aip-partners";
import { DEMO_AIP_PARTNERS } from "../src/lib/seed-data/demo";

test("normalizeWebsite adds https and keeps full URLs", () => {
  assert.equal(normalizeWebsite("example.com"), "https://example.com/");
  assert.equal(normalizeWebsite("  www.example.com/team "), "https://www.example.com/team");
  assert.equal(normalizeWebsite("http://example.com/a?b=1"), "http://example.com/a?b=1");
  assert.equal(normalizeWebsite(""), null);
});

test("normalizeWebsite rejects non-web addresses", () => {
  assert.throws(() => normalizeWebsite("javascript:alert(1)"));
  assert.throws(() => normalizeWebsite("mailto:a@example.com"));
  assert.throws(() => normalizeWebsite("not a website"));
  assert.throws(() => normalizeWebsite("localhost"));
});

test("categories have unique keys and labels resolve", () => {
  assert.equal(new Set(AIP_PARTNER_CATEGORIES.map((c) => c.key)).size, AIP_PARTNER_CATEGORIES.length);
  assert.equal(aipPartnerCategoryLabel("healthcare-therapy"), "Healthcare & Therapy");
  assert.equal(aipPartnerCategoryLabel("unknown"), "Specialized Services");
  assert.ok(!isAipPartnerCategory("unknown"));
});

test("demo partners use real category keys and are marked as samples", () => {
  for (const [name, category, , relationship] of DEMO_AIP_PARTNERS) { assert.ok(isAipPartnerCategory(category), category); assert.ok(isAipPartnerRelationship(relationship), relationship); assert.ok(name.startsWith("Sample:"), name); }
});

test("relationship labels resolve with a safe fallback", () => {
  assert.equal(aipPartnerRelationshipLabel("collaborator"), "GID collaborator");
  assert.equal(aipPartnerRelationshipLabel("anything-else"), "Known professional");
});

test("image kind is photo only when asked for, otherwise logo", () => {
  assert.equal(partnerImageKind("photo"), "photo");
  assert.equal(partnerImageKind("logo"), "logo");
  assert.equal(partnerImageKind(""), "logo");
  assert.equal(partnerImageKind(null), "logo");
  assert.equal(partnerImageKind("banner"), "logo");
});
