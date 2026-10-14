import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSender, resolveSenders, DEFAULT_SENDER_ADDRESSES, isEmailSender } from "../src/lib/email-senders";

test("parseSender accepts display-name and bare address forms", () => {
  assert.deepEqual(parseSender("Grace In Design <Consultation@GraceInDesign.net>", "x@y.z"), { name: "Grace In Design", email: "consultation@graceindesign.net", formatted: "Grace In Design <consultation@graceindesign.net>" });
  assert.deepEqual(parseSender("support@graceindesign.net", "x@y.z"), { name: "Grace In Design", email: "support@graceindesign.net", formatted: "Grace In Design <support@graceindesign.net>" });
  assert.deepEqual(parseSender("\"Grace\" <g@graceindesign.net>", "x@y.z").name, "Grace");
});

test("parseSender falls back to the verified default when the value is blank or malformed", () => {
  assert.equal(parseSender("", "noreply@graceindesign.net").email, "noreply@graceindesign.net");
  assert.equal(parseSender("not an address", "noreply@graceindesign.net").email, "noreply@graceindesign.net");
  assert.equal(parseSender(undefined, "newsletter@graceindesign.net").formatted, "Grace In Design <newsletter@graceindesign.net>");
});

test("resolveSenders defaults to the four verified SendGrid addresses", () => {
  const s = resolveSenders({});
  assert.equal(s.noreply.email, DEFAULT_SENDER_ADDRESSES.noreply);
  assert.equal(s.support.email, DEFAULT_SENDER_ADDRESSES.support);
  assert.equal(s.consultation.email, DEFAULT_SENDER_ADDRESSES.consultation);
  assert.equal(s.newsletter.email, DEFAULT_SENDER_ADDRESSES.newsletter);
});

test("legacy EMAIL_FROM still drives the support sender, explicit EMAIL_FROM_SUPPORT wins", () => {
  assert.equal(resolveSenders({ EMAIL_FROM: "GID <hello@graceindesign.net>" }).support.email, "hello@graceindesign.net");
  assert.equal(resolveSenders({ EMAIL_FROM: "GID <hello@graceindesign.net>", EMAIL_FROM_SUPPORT: "support@graceindesign.net" }).support.email, "support@graceindesign.net");
  assert.equal(resolveSenders({ EMAIL_FROM: "GID <hello@graceindesign.net>" }).consultation.email, "consultation@graceindesign.net");
});

test("isEmailSender only accepts the known keys", () => {
  assert.equal(isEmailSender("consultation"), true);
  assert.equal(isEmailSender("Grace <x@y.z>"), false);
  assert.equal(isEmailSender(undefined), false);
});
