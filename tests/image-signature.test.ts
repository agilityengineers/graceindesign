import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCEPTED_PHOTO_TYPES, detectImageType, isAcceptedPhotoMime, isPublicPhotoKey } from "../src/lib/image-signature";

const bytes = (...parts: (string | number[] | Uint8Array)[]) =>
  Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p))));
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

test("recognises the four accepted raster formats by their first bytes", () => {
  assert.deepEqual(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF")), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(detectImageType(bytes([0xff, 0xd8, 0xff, 0xe1], "Exif")), { mime: "image/jpeg", ext: "jpg" });
  assert.deepEqual(detectImageType(bytes(PNG_HEADER, [0, 0, 0, 13], "IHDR")), { mime: "image/png", ext: "png" });
  assert.deepEqual(detectImageType(bytes("GIF87a", [1, 0, 1, 0])), { mime: "image/gif", ext: "gif" });
  assert.deepEqual(detectImageType(bytes("GIF89a", [1, 0, 1, 0])), { mime: "image/gif", ext: "gif" });
  assert.deepEqual(detectImageType(bytes("RIFF", [0x24, 0, 0, 0], "WEBPVP8 ")), { mime: "image/webp", ext: "webp" });
});

test("accepts a plain Uint8Array as well as a Buffer", () => {
  assert.deepEqual(detectImageType(new Uint8Array([0xff, 0xd8, 0xff])), { mime: "image/jpeg", ext: "jpg" });
});

test("refuses scriptable and non-image content however it is labelled", () => {
  for (const sample of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
    "<!DOCTYPE html><html><body>hi</body></html>",
    "%PDF-1.4 ...",
    "plain text",
  ]) assert.equal(detectImageType(bytes(sample)), null, sample);
});

test("refuses near-misses and truncated headers", () => {
  assert.equal(detectImageType(new Uint8Array(0)), null, "empty");
  assert.equal(detectImageType(bytes([0xff, 0xd8])), null, "two-byte JPEG prefix");
  assert.equal(detectImageType(bytes([0xff, 0xd8, 0x00])), null, "wrong third byte");
  assert.equal(detectImageType(bytes(PNG_HEADER.slice(0, 7))), null, "seven-byte PNG prefix");
  assert.equal(detectImageType(bytes("GIF88a")), null, "unknown GIF version");
  assert.equal(detectImageType(bytes("GIF89")), null, "five-byte GIF prefix");
  assert.equal(detectImageType(bytes(" GIF89a")), null, "leading space");
  assert.equal(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WAVEfmt ")), null, "RIFF but not WebP");
  assert.equal(detectImageType(bytes("RIFF", [0, 0, 0, 0], "WEB")), null, "eleven-byte RIFF prefix");
});

test("the decision takes only bytes, so filename and declared type cannot influence it", () => {
  assert.equal(detectImageType.length, 1);
});

test("accepted-type and key helpers", () => {
  for (const mime of Object.keys(ACCEPTED_PHOTO_TYPES)) assert.equal(isAcceptedPhotoMime(mime), true, mime);
  assert.equal(isAcceptedPhotoMime("image/svg+xml"), false);
  assert.equal(isAcceptedPhotoMime("text/html"), false);
  assert.equal(isAcceptedPhotoMime("constructor"), false);
  assert.equal(isPublicPhotoKey("leads/photos/abc.svg"), true);
  assert.equal(isPublicPhotoKey("leads/photosx/abc.png"), false);
  assert.equal(isPublicPhotoKey("media/leads/photos/abc.png"), false);
});
