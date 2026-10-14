import { test } from "node:test";
import assert from "node:assert/strict";
import { signCftLaunchToken, verifyCftLaunchToken, cftSubjectFor, cftLaunchUrl, CFT_MAX_TOKEN_LIFETIME_SEC } from "../src/lib/cft-launch-token";

const secret = "test-master-dashboard-secret";
const appId = "608c99a8-0a2b-41d7-8930-f2dc3b0fe964";

test("a minted token verifies the way Call Flow Tracker checks it", () => {
  const { token, payload } = signCftLaunchToken({ secret, appId, sub: "gid:user:1", email: "Info@GraceInDesign.net", name: "Grace A. Williams", role: "admin" });
  const v = verifyCftLaunchToken(token, secret, appId);
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.payload.aud, appId);
  assert.equal(v.payload.sub, "gid:user:1");
  assert.equal(v.payload.email, "info@graceindesign.net");
  assert.equal(v.payload.firstName, "Grace");
  assert.equal(v.payload.lastName, "A. Williams");
  assert.equal(v.payload.role, "admin");
  assert.ok(v.payload.jti.length > 10);
  assert.equal(v.payload.exp - v.payload.iat, 120);
  assert.equal(payload.jti, v.payload.jti);
});

test("wrong secret, wrong audience and expiry are all refused", () => {
  const { token } = signCftLaunchToken({ secret, appId, sub: "s", email: "a@b.c" });
  assert.deepEqual(verifyCftLaunchToken(token, "other", appId), { ok: false, reason: "bad_sig" });
  assert.deepEqual(verifyCftLaunchToken(token, secret, "11111111-2222-3333-4444-555555555555"), { ok: false, reason: "wrong_aud" });
  assert.deepEqual(verifyCftLaunchToken(token, secret, appId, Date.now() + 3 * 60_000), { ok: false, reason: "expired" });
  assert.deepEqual(verifyCftLaunchToken("garbage", secret, appId), { ok: false, reason: "bad_sig" });
});

test("ttl is capped at what Call Flow Tracker accepts", () => {
  const { payload } = signCftLaunchToken({ secret, appId, sub: "s", email: "a@b.c", ttlSec: 10 * 24 * 3600 });
  assert.equal(payload.exp - payload.iat, CFT_MAX_TOKEN_LIFETIME_SEC);
});

test("every token carries a fresh jti so CFT's replay protection never trips on a second tap", () => {
  const a = signCftLaunchToken({ secret, appId, sub: "s", email: "a@b.c" });
  const b = signCftLaunchToken({ secret, appId, sub: "s", email: "a@b.c" });
  assert.notEqual(a.payload.jti, b.payload.jti);
  assert.notEqual(a.token, b.token);
});

test("subjects are stable per person and never leak the raw email", () => {
  assert.equal(cftSubjectFor({ id: 7, email: "x@y.z" }), "gid:user:7");
  const s = cftSubjectFor({ email: "Grace@GraceInDesign.net" });
  assert.equal(s, cftSubjectFor({ email: "grace@graceindesign.net " }));
  assert.ok(!s.includes("@"));
});

test("launch URL targets CFT's /sso/launch and can ask for JSON", () => {
  assert.equal(cftLaunchUrl("https://cft.example/", "a.b"), "https://cft.example/sso/launch?token=a.b");
  assert.equal(cftLaunchUrl("https://cft.example", "a.b", true), "https://cft.example/sso/launch?token=a.b&return=json");
});
