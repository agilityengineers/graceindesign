import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { WALKTHROUGH_PAGE_PATH, WALKTHROUGH_PDF_PATH, WALKTHROUGH_PDF_FILENAME, cleanFirstName, mediaKeyFromUrl, walkthroughEmail } from "../src/lib/walkthrough";
import { DEFAULT_WALKTHROUGH_ITEMS } from "../src/lib/wellness";
import { buildWalkthroughPdf } from "../src/lib/server/pdf";

test("the PDF lives beside the download page, under a stable file name", () => {
  assert.equal(WALKTHROUGH_PAGE_PATH, "/healthy-home-resources/wellness/checklist");
  assert.equal(WALKTHROUGH_PDF_PATH, `${WALKTHROUGH_PAGE_PATH}/${WALKTHROUGH_PDF_FILENAME}`);
  assert.match(WALKTHROUGH_PDF_PATH, /\.pdf$/, "ends in .pdf so mail clients and the resource cards treat it as a document");
});

test("the checklist email greets the person by first name and carries both full links on their own", () => {
  const e = walkthroughEmail({ firstName: "Ann", title: "The 10-Minute Healthy Home Walk-Through", downloadUrl: "https://graceindesign.net/healthy-home-resources/wellness/checklist/healthy-home-walkthrough.pdf", pageUrl: "https://graceindesign.net/healthy-home-resources/wellness/checklist" });
  assert.equal(e.subject, "Your 10-Minute Healthy Home Walk-Through", "the leading 'The' gives way to 'Your'");
  assert.match(e.text, /^Hi Ann,\n\n/);
  assert.ok(e.text.split("\n").includes("https://graceindesign.net/healthy-home-resources/wellness/checklist/healthy-home-walkthrough.pdf"), "the download link stands on its own line");
  assert.ok(e.text.includes("anytime: https://graceindesign.net/healthy-home-resources/wellness/checklist"));
  assert.equal(/(^|\s)\/healthy-home-resources/.test(e.text), false, "no bare site path: every link is a full https:// address");
  assert.match(e.text, /\n\nGrace In Design$/);
  const anon = walkthroughEmail({ firstName: "  ", title: "", downloadUrl: "https://x/y.pdf", pageUrl: "https://x/y" });
  assert.match(anon.text, /^Hi there,/, "no usable name → a plain greeting");
  assert.equal(anon.subject, "Your 10-Minute Healthy Home Walk-Through", "a blank title falls back to the standard one");
});

test("a typed first name is tidied, never trusted as-is", () => {
  assert.equal(cleanFirstName("  Grace   A.\tWilliams "), "Grace A. Williams");
  assert.equal(cleanFirstName("Ann\nBcc: evil@example.com"), "Ann Bcc: evil@example.com", "line breaks cannot smuggle headers or paragraphs into the email");
  assert.equal(cleanFirstName("x".repeat(200)).length, 100);
  assert.equal(cleanFirstName(42), "");
  assert.equal(cleanFirstName(null), "");
});

test("the uploaded PDF is found however the admin pasted its link", () => {
  assert.equal(mediaKeyFromUrl("/api/media/pages/3/blocks/1793700000000-walkthrough.pdf"), "pages/3/blocks/1793700000000-walkthrough.pdf");
  assert.equal(mediaKeyFromUrl("https://graceindesign.net/api/media/library/1793700000000-guide.pdf"), "library/1793700000000-guide.pdf", "an absolute link on our own site");
  assert.equal(mediaKeyFromUrl("/API/Media/library/x.pdf"), "library/x.pdf", "letter case does not matter");
  assert.equal(mediaKeyFromUrl("/api/media/library/my%20guide.pdf"), "library/my guide.pdf", "percent-encoding is undone");
  assert.equal(mediaKeyFromUrl("/assets/logo.png"), null, "not a media link");
  assert.equal(mediaKeyFromUrl("https://example.com/other.pdf"), null, "somebody else's file is not ours to serve");
  assert.equal(mediaKeyFromUrl(""), null);
  assert.equal(mediaKeyFromUrl(undefined), null);
});

test("the generated checklist runs to as many pages as the items need, and the defaults fit on one", async () => {
  const one = await PDFDocument.load(await buildWalkthroughPdf({ items: DEFAULT_WALKTHROUGH_ITEMS }));
  assert.equal(one.getPageCount(), 1);
  const many = await PDFDocument.load(await buildWalkthroughPdf({ title: "A long walk-through", items: Array.from({ length: 40 }, (_, i) => `Item ${i + 1}: a long line of checklist text that wraps onto a second line to fill the page sooner than a short one would.`) }));
  assert.ok(many.getPageCount() >= 3, `40 two-line items need several pages, got ${many.getPageCount()}`);
});
