import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { COMMUNICATION_LOGO_HTML, COMMUNICATION_LOGO_CID, communicationLogoAttachment } from "../src/lib/server/communication-brand";
import { buildChecklistPdf, buildProposalPdf } from "../src/lib/server/pdf";

test("inline email logo is byte-for-byte the original site-header artwork", async () => {
  const attachment = await communicationLogoAttachment();
  assert.deepEqual(Buffer.from(attachment.content, "base64"), await readFile("public/assets/logo-dark-transparent.png"));
  assert.equal(attachment.content_id, COMMUNICATION_LOGO_CID);
  assert.equal(attachment.disposition, "inline");
  assert.equal(attachment.type, "image/png");
  assert.match(COMMUNICATION_LOGO_HTML, /alt="Grace In Design"/);
  const nav = await readFile("src/components/site/SiteNav.tsx", "utf8");
  assert.match(nav, /\/assets\/logo-dark-transparent\.png/);
});

test("shared email template uses the embedded image and preserves escaped text and fragments", async () => {
  // Isolate this pure formatter without loading the outbox's database dependencies.
  const source = await readFile("src/lib/server/outbox.ts", "utf8");
  const formatter = source.slice(source.indexOf("export function textToHtml("));
  const js = ts.transpileModule(formatter.replace("export function", "function"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const render = new Function("COMMUNICATION_LOGO_HTML", `${js}; return textToHtml;`)(COMMUNICATION_LOGO_HTML);
  const html = render('<unsafe>\n\nhttps://example.invalid/auth/verify#token=noncredential', "support@example.invalid");
  assert.ok(html.includes(COMMUNICATION_LOGO_HTML));
  assert.ok(html.includes("&lt;unsafe&gt;"));
  assert.ok(html.includes("/auth/verify#token=noncredential"));
  assert.ok(!html.includes("<span"));
  assert.match(source, /communicationLogoAttachment\(\)/);
  assert.match(source, /row\.attachments\?\.map/);
});

test("outbound checklist and every proposal page embed a logo image", async () => {
  const files = [
    await buildChecklistPdf({ name: "Test", pathLabel: "Residential", consultType: "Consultation", when: "Test date" }),
    await buildProposalPdf({ title: "Test proposal", body: "Test content.\n".repeat(100), status: "draft" }),
  ];
  for (const bytes of files) {
    const pdf = await PDFDocument.load(bytes);
    for (const page of pdf.getPages()) {
      const resources = page.node.Resources();
      const images = resources?.lookup(PDFName.of("XObject"), PDFDict);
      assert.ok(images && images.keys().length > 0, "Each PDF page embeds artwork");
    }
  }
});
