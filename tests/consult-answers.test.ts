import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_PHOTO_PREFIX, isLeadPhotoPath, isMediaPath, looksLikeLink, sanitizeAnswers } from "../src/lib/consult-answers";

const P = LEAD_PHOTO_PREFIX;

test("a submission keeps only the photo uploaded through the form", () => {
  const out = sanitizeAnswers({ photos: ["//evil.example/x", "https://evil.example/x", "/api/media/leads/photos/abc.png"] });
  assert.deepEqual(out.photos, ["/api/media/leads/photos/abc.png"]);
});

test("isLeadPhotoPath accepts exactly what the upload route mints", () => {
  assert.ok(isLeadPhotoPath(`${P}V1StGXR8_Z.jpg`));
  assert.ok(isLeadPhotoPath(`${P}-a_b.heic`));
  for (const bad of [
    `${P}../x`, `${P}a.png?x`, `${P}a.png#x`, `${P}a b.png`, `${P}a.png\n`, P, `${P}a`, `${P}a.PNG`, `${P}a\\b.png`, `${P}%2e%2e/x.png`,
    "/api/media/other/x.png", ` ${P}a.png`, "/API/media/leads/photos/a.png", `https://graceindesign.net${P}a.png`, `//evil.example${P}a.png`,
  ]) assert.ok(!isLeadPhotoPath(bad), bad);
  for (const notString of [42, null, undefined, [`${P}a.png`], { url: `${P}a.png` }]) assert.ok(!isLeadPhotoPath(notString));
});

test("isMediaPath allows same-origin media only, nothing a browser could resolve elsewhere", () => {
  assert.ok(isMediaPath("/api/media/leads/photos/a.png"));
  assert.ok(isMediaPath("/api/media/pages/hero.jpg"));
  for (const bad of [
    "/api/media/../../auth/signout", "/api/media/%2e%2e/auth/signout", "/api/media/\\..\\x", "/api/media/a b.png", "/api/media/a.png\t",
    "//evil.example/api/media/x", "https://evil.example/api/media/x", "/api/medias/x.png", "api/media/x.png",
  ]) assert.ok(!isMediaPath(bad), bad);
  for (const notString of [42, null, undefined, ["/api/media/x.png"]]) assert.ok(!isMediaPath(notString));
});

test("looksLikeLink flags paths and URLs but leaves option labels alone", () => {
  for (const link of [
    "//evil.example", " //evil.example", "/anything", "\\\\evil", "https://evil.example/x", "HTTPS://evil.example", "ftp://x",
    "javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>", "vbscript:msgbox", "file:///etc/passwd", "blob:https://x",
  ]) assert.ok(looksLikeLink(link), link);
  for (const label of ["Kitchen", "Stairs / entry", "Not sure", "Note: text", "Data: pending", "N/A", "C:\\Users", "Whole home", ""]) assert.ok(!looksLikeLink(label), label);
});

test("multiple-choice answers pass through untouched", () => {
  const input = { rooms: ["Kitchen", "Stairs / entry"], concerns: ["Not sure", "Note: text"] };
  assert.deepEqual(sanitizeAnswers(input), input);
});

test("every link-shaped or non-string element in a list is dropped", () => {
  const out = sanitizeAnswers({ photos: ["javascript:alert(1)", "data:text/html,x", "\\\\evil", " //evil", `${P}../x`, 1, { url: "https://evil" }, null, true, [`${P}a.png`], `${P}ok.webp`] });
  assert.deepEqual(out.photos, [`${P}ok.webp`]);
});

test("non-list answers are untouched and the input is not mutated", () => {
  const input = { name: "Jane", consent: true, n: 3, nested: { photos: ["//evil"] }, notes: "see https://example.com", missing: undefined, photos: ["//evil"] };
  const out = sanitizeAnswers(input);
  assert.notEqual(out, input);
  assert.equal(out.name, "Jane"); assert.equal(out.consent, true); assert.equal(out.n, 3); assert.equal(out.notes, "see https://example.com");
  assert.deepEqual(out.nested, { photos: ["//evil"] }); assert.ok("missing" in out && out.missing === undefined);
  assert.deepEqual(out.photos, []);
  assert.deepEqual(input.photos, ["//evil"]);
});

test("an own __proto__ key stays an ordinary key", () => {
  const out = sanitizeAnswers(JSON.parse('{"__proto__":{"polluted":true},"photos":[]}'));
  assert.equal((out as { polluted?: unknown }).polluted, undefined);
  assert.ok(Object.prototype.hasOwnProperty.call(out, "__proto__"));
  assert.equal(({} as { polluted?: unknown }).polluted, undefined);
});
