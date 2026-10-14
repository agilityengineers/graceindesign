import { test } from "node:test";
import assert from "node:assert/strict";
import { isSeedSocialAccount, isSeedSocialPost, isSeedSubscriber } from "../scripts/launch-cleanup-matches";

test("only unchanged seed social posts without provider results match", () => {
  const p = { body: "Why model homes sell communities", networks: ["linkedin"], status: "scheduled",
    imageUrl: null, linkUrl: null, originPostId: null, results: {}, metrics: {} };
  assert.ok(isSeedSocialPost(p));
  for (const change of [{ body: "My real post" }, { networks: ["facebook"] }, { status: "published" },
    { linkUrl: "https://example.com" }, { results: { linkedin: { id: "real" } } }, { metrics: { linkedin: { clicks: 1 } } }]) {
    assert.equal(isSeedSocialPost({ ...p, ...change }), false);
  }
});

test("disconnected or expired real social accounts are retained", () => {
  const a = { network: "facebook", displayName: "Facebook", followers: 860, status: "connected",
    accessTokenEnc: null, refreshTokenEnc: null, externalId: null, tokenExpiresAt: null, lastSyncedAt: null, meta: {} };
  assert.ok(isSeedSocialAccount(a));
  for (const change of [{ displayName: "Real business" }, { followers: 861 }, { externalId: "real" },
    { refreshTokenEnc: "synthetic" }, { lastSyncedAt: new Date() }, { meta: { configured: true } }]) {
    assert.equal(isSeedSocialAccount({ ...a, ...change }), false);
  }
});

test("subscriber matching uses exact seed identities and bounded padding", () => {
  const s = { email: "subscriberliving-i162@example.com", segment: "Living in Jamaica",
    location: "Jamaica", country: "Jamaica", unsubscribedAt: null };
  assert.ok(isSeedSubscriber(s));
  for (const change of [{ email: "customer@example.com" }, { email: "subscriberliving-i163@example.com" },
    { location: "Updated location" }, { unsubscribedAt: new Date() }]) {
    assert.equal(isSeedSubscriber({ ...s, ...change }), false);
  }
});
