import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyMediaKey, isPrivateMedia, portalMayOpen, privateFileHeaders, publicFileHeaders, withPortalToken, safeKey } from "../src/lib/media-access";

test("keys under leads/ and projects/ are private, everything else is public", () => {
  assert.equal(classifyMediaKey("leads/12/1700000000000-proposal.pdf").kind, "lead");
  assert.equal(classifyMediaKey("leads/photos/abc123xyz0.jpg").kind, "lead_photo");
  assert.equal(classifyMediaKey("projects/7/1700000000000-plan.pdf").kind, "project");
  // Odd shapes under a private folder fail closed rather than falling through to public.
  assert.equal(classifyMediaKey("leads/abc/x.pdf").kind, "lead");
  assert.equal(classifyMediaKey("leads/photos").kind, "lead_photo");
  assert.equal(classifyMediaKey("projects/x/y/z.pdf").kind, "project");
  assert.equal(classifyMediaKey("leads").kind, "lead");
  for (const k of ["library/1700000000000-hero.jpg", "hero/page/3/1700000000000-a.webp", "services/aging-in-place/x.jpg", "products/x.png", "team/grace.jpg", "generated/home.png", "leadsfoo/x.pdf", "projectsx/y.pdf", "my-leads/x.pdf"]) {
    assert.equal(classifyMediaKey(k).kind, "public", k);
  }
  assert.equal(isPrivateMedia("lead") && isPrivateMedia("lead_photo") && isPrivateMedia("project"), true);
  assert.equal(isPrivateMedia("public") || isPrivateMedia("invalid"), false);
  assert.equal(portalMayOpen("lead") && portalMayOpen("project"), true);
  assert.equal(portalMayOpen("lead_photo") || portalMayOpen("public"), false);
});

test("the decision is made on the normalised key that storage reads", () => {
  // Same character rule as storage: anything odd becomes a dash, leading slashes go.
  assert.equal(safeKey("/leads/1/My File (final).pdf"), "leads/1/My-File-final-.pdf");
  assert.equal(classifyMediaKey("/leads/1/x.pdf").kind, "lead");
  assert.equal(classifyMediaKey("leads/1/x.pdf").key, "leads/1/x.pdf");
  assert.equal(classifyMediaKey("library/a b.png").key, "library/a-b.png");
  // Dot segments and empty segments are refused outright.
  for (const k of ["./leads/1/x.pdf", "leads/./1/x.pdf", "../leads/1/x.pdf", "leads/../library/x.png", "library//x.png", "leads/1/", "", "/"]) {
    assert.equal(classifyMediaKey(k).kind, "invalid", k);
  }
});

test("private files are never cached or indexed, open inline only when safe, and keep a readable name", () => {
  const pdf = privateFileHeaders("leads/12/1700000000000-Proposal-v2.pdf", "application/pdf");
  assert.equal(pdf["cache-control"], "private, no-store");
  assert.equal(pdf["content-disposition"], 'inline; filename="Proposal-v2.pdf"');
  assert.equal(pdf["content-type"], "application/pdf");
  assert.equal(pdf["content-security-policy"], "default-src 'none'");
  assert.equal(pdf["referrer-policy"], "no-referrer");
  assert.equal(pdf["x-content-type-options"], "nosniff");
  assert.equal(pdf["x-robots-tag"], "noindex");
  assert.equal(privateFileHeaders("leads/photos/abc123xyz0.jpg", "image/jpeg")["content-disposition"], 'inline; filename="abc123xyz0.jpg"');
  assert.equal(privateFileHeaders("projects/3/1700000000000-walkthrough.mp4", "video/mp4")["content-disposition"], 'inline; filename="walkthrough.mp4"');
  // SVG can carry script, so it downloads instead of rendering on this origin; unknown types download too.
  assert.equal(privateFileHeaders("leads/photos/logo.svg", "image/svg+xml")["content-disposition"], 'attachment; filename="logo.svg"');
  assert.equal(privateFileHeaders("projects/3/1700000000000-site.zip", "application/octet-stream")["content-disposition"], 'attachment; filename="site.zip"');
  // No timestamp prefix: the name is kept as is; a 12-digit number is not a timestamp.
  assert.equal(privateFileHeaders("projects/3/plan.pdf", "application/pdf")["content-disposition"], 'inline; filename="plan.pdf"');
  assert.equal(privateFileHeaders("projects/3/170000000000-plan.pdf", "application/pdf")["content-disposition"], 'inline; filename="170000000000-plan.pdf"');
  for (const v of Object.values(pdf)) assert.doesNotMatch(v, /[\r\n"]{2}|[\r\n]/);
  // Public site content keeps the long-lived cache.
  assert.deepEqual(publicFileHeaders("library/1700000000000-hero.webp", "image/webp"), { "content-type": "image/webp", "content-disposition": 'inline; filename="hero.webp"', "cache-control": "public, max-age=31536000, immutable" });
  assert.equal(publicFileHeaders("pages/3/blocks/1793700000000-walkthrough.pdf", "application/pdf")["content-disposition"], 'inline; filename="walkthrough.pdf"');
});

test("portal document links carry the portal token only for internal media URLs", () => {
  assert.equal(withPortalToken("/api/media/projects/7/1700000000000-plan.pdf", "tok_abc"), "/api/media/projects/7/1700000000000-plan.pdf?portal=tok_abc");
  assert.equal(withPortalToken("/api/media/leads/12/x.pdf?v=2", "tok_abc"), "/api/media/leads/12/x.pdf?v=2&portal=tok_abc");
  assert.equal(withPortalToken("/api/media/projects/7/x.pdf", "a b/c"), "/api/media/projects/7/x.pdf?portal=a%20b%2Fc");
  assert.equal(withPortalToken("https://drive.google.com/file/d/abc/view", "tok_abc"), "https://drive.google.com/file/d/abc/view");
  assert.equal(withPortalToken("/admin/leads?open=12", "tok_abc"), "/admin/leads?open=12");
});
