import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mediaUploadError } from "../src/lib/upload-limits";

const mb = 1024 * 1024;
test("PDFs accept larger documents through 100 MB inclusive", () => {
  for (const size of [16 * mb, 50 * mb, 100 * mb]) {
    assert.equal(mediaUploadError({ name: "guide.pdf", type: "application/pdf", size }), null);
  }
  assert.equal(mediaUploadError({ name: "guide.pdf", type: "application/pdf", size: 100 * mb + 1 }), "File is larger than 100 MB");
});
test("PDF extension supports browsers without a MIME type", () => {
  assert.equal(mediaUploadError({ name: "GUIDE.PDF", type: "", size: 100 * mb }), null);
});
test("other files retain the 15 MB limit and empty files fail", () => {
  assert.equal(mediaUploadError({ name: "photo.jpg", type: "image/jpeg", size: 15 * mb }), null);
  assert.equal(mediaUploadError({ name: "photo.jpg", type: "image/jpeg", size: 15 * mb + 1 }), "File is larger than 15 MB");
  assert.equal(mediaUploadError({ name: "guide.pdf", type: "application/pdf", size: 0 }), "Choose a file first");
});
