import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { emailTrackingSettings } from "../src/lib/server/email-tracking";

const require = createRequire(import.meta.url);
const Mail = require("@sendgrid/helpers/classes/mail");

for (const [kind, content] of Object.entries({
  signIn: { text: "https://example.invalid/auth/verify#token=not-a-credential" },
  ordinary: { text: "https://example.invalid/contact?from=email" },
  htmlOnly: { html: '<a href="https://example.invalid/reviews">Reviews</a>' },
})) {
  test(`${kind}: SendGrid wire payload disables rewriting in both MIME modes`, () => {
    const message = Mail.create({
      to: "test@example.invalid", from: "support@example.invalid", subject: "Test",
      ...content, trackingSettings: emailTrackingSettings(),
    }).toJSON();
    assert.deepEqual(message.tracking_settings.click_tracking, { enable: false, enable_text: false });
    assert.equal(message.content[0].value, Object.values(content)[0]);
  });
}

test("the single delivery path applies the policy without matching a sign-in URL", async () => {
  const source = await readFile("src/lib/server/outbox.ts", "utf8");
  assert.match(source, /trackingSettings: emailTrackingSettings\(\)/);
  assert.doesNotMatch(source, /trackingSettings:\s*\{\s*clickTracking/);
  assert.equal((source.match(/sg\.send\(/g) || []).length, 1);
});
