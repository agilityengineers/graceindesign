import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIENCES, AUDIENCE_KEYS, isAudienceKey, countryFromLocation, fromCaribbeanRow, fromHealthyHomeRow,
  buildInstaSubscriberBody, interpretSubscribeResponse, interpretUnsubscribeResponse, describeInstaStatus, needsPush,
  filterSubscribers, summarizeSubscribers, subscribersCsv, normalizeInstaUrl, looksLikeInstaApiKey, missingInstaScopes, instaLinks,
  type SubscriberRecord,
} from "../src/lib/newsletter";

const when = new Date("2026-10-31T19:00:00Z");
const sync = { instaStatus: null, instaContactId: null, instaSyncedAt: null, instaError: null, consentIp: null, sourcePage: null };
const cc = fromCaribbeanRow({ id: 1, email: "ann@example.com", segment: "Living in Jamaica", location: "Kingston, Jamaica", country: "Jamaica", consentedAt: when, unsubscribedAt: null, createdAt: when, ...sync, consentIp: "203.0.113.5", sourcePage: "https://graceindesign.net/caribbean-connection" });
const hh = fromHealthyHomeRow({ id: 2, email: "bob@example.com", source: "wellness-checklist", consentedAt: when, unsubscribedAt: null, ...sync });
const rec = (patch: Partial<SubscriberRecord>): SubscriberRecord => ({ ...cc, ...patch });

test("the two website lists map onto two Insta-Newsletter audiences", () => {
  assert.deepEqual(AUDIENCE_KEYS, ["caribbean-connection", "healthy-home"]);
  assert.equal(AUDIENCES["caribbean-connection"].name, "Caribbean Connection");
  assert.equal(AUDIENCES["healthy-home"].name, "Healthy Home");
  assert.equal(isAudienceKey("healthy-home"), true);
  assert.equal(isAudienceKey("newsletter"), false);
  assert.equal(countryFromLocation("Kingston, Jamaica"), "Jamaica");
  assert.equal(countryFromLocation("Atlanta, GA"), "Diaspora");
  assert.equal(countryFromLocation(""), null);
  assert.equal(hh.audience, "healthy-home");
  assert.equal(hh.createdAt, when, "the Healthy Home table has no created_at; consent time stands in");
});

test("the request body carries only fields Insta-Newsletter's /v1/subscribers knows, with consent evidence", () => {
  const body = buildInstaSubscriberBody(cc, "aud_123", { doubleOptIn: false, siteUrl: "https://graceindesign.net/" });
  assert.deepEqual(Object.keys(body).sort(), ["audienceIds", "consent", "customFields", "doubleOptIn", "email", "tags"]);
  assert.deepEqual(body.audienceIds, ["aud_123"]);
  assert.deepEqual(body.tags, ["website", "caribbean-connection", "Living in Jamaica"]);
  assert.deepEqual(body.customFields, { website_list: "Caribbean Connection", source: "caribbean-newsletter", segment: "Living in Jamaica", location: "Kingston, Jamaica", country: "Jamaica" });
  assert.deepEqual(body.consent, { at: "2026-10-31T19:00:00.000Z", ip: "203.0.113.5", page: "https://graceindesign.net/caribbean-connection" });
  assert.equal(body.doubleOptIn, false);
  const hhBody = buildInstaSubscriberBody(hh, "aud_h", { doubleOptIn: true, siteUrl: "https://graceindesign.net" });
  assert.deepEqual(hhBody.tags, ["website", "healthy-home"]);
  assert.equal(hhBody.consent.page, "https://graceindesign.net/healthy-home-resources/wellness", "no page recorded → the form's own page");
  assert.equal("ip" in hhBody.consent, false, "no IP → the key is left out rather than sent as null");
  assert.equal(hhBody.doubleOptIn, true);
  for (const t of body.tags) assert.ok(t.length <= 50);
});

test("what Insta-Newsletter answers becomes a status the admin can read", () => {
  const sub = { id: "c1" };
  assert.deepEqual(interpretSubscribeResponse(201, { status: "created", subscriber: sub }), { status: "synced", contactId: "c1", error: null, retry: false, connectionProblem: false });
  assert.equal(interpretSubscribeResponse(200, { status: "updated", subscriber: sub }).status, "synced");
  assert.equal(interpretSubscribeResponse(200, { status: "suppressed", subscriber: sub }).status, "suppressed");
  assert.equal(interpretSubscribeResponse(202, { status: "pending", email: "x" }).status, "confirming");
  const limit = interpretSubscribeResponse(403, { error: "The account's plan allows 500 contacts and has 500.", code: "CONTACT_LIMIT_REACHED" });
  assert.equal(limit.status, "failed"); assert.equal(limit.retry, false); assert.match(limit.error!, /500 contacts/);
  const badKey = interpretSubscribeResponse(401, { error: "That API key is not recognised.", code: "INVALID_API_KEY" });
  assert.equal(badKey.status, "queued"); assert.equal(badKey.connectionProblem, true); assert.match(badKey.error!, /Check the Insta-Newsletter connection/);
  assert.equal(interpretSubscribeResponse(429, { code: "RATE_LIMITED" }).status, "queued");
  assert.equal(interpretSubscribeResponse(500, {}).status, "queued");
  assert.equal(interpretSubscribeResponse(0, { error: "Could not reach Insta-Newsletter", code: "NETWORK" }).status, "queued");
  const noAudience = interpretSubscribeResponse(404, { code: "AUDIENCE_NOT_FOUND", missing: ["aud_123"] });
  assert.equal(noAudience.status, "failed"); assert.equal(noAudience.connectionProblem, true);
  assert.equal(interpretSubscribeResponse(400, { code: "VALIDATION_ERROR", error: "Enter a valid email address" }).status, "failed");
  assert.equal(interpretUnsubscribeResponse(200, { status: "unsubscribed", subscriber: sub }).status, "removed");
  assert.equal(interpretUnsubscribeResponse(404, { code: "SUBSCRIBER_NOT_FOUND" }).status, "removed", "a contact Insta-Newsletter never had counts as removed");
  assert.equal(interpretUnsubscribeResponse(503, {}).status, "queued");
});

test("the status pill says what to do next", () => {
  assert.equal(describeInstaStatus(rec({ instaStatus: null }), false).label, "Not sent yet");
  assert.equal(describeInstaStatus(rec({ instaStatus: null }), false).detail, "Connect Insta-Newsletter to send");
  assert.equal(describeInstaStatus(rec({ instaStatus: null }), true).tone, "wait");
  assert.equal(describeInstaStatus(rec({ instaStatus: "synced" }), true).label, "In Insta-Newsletter");
  assert.equal(describeInstaStatus(rec({ instaStatus: "failed", instaError: "plan full" }), true).detail, "plan full");
  assert.equal(describeInstaStatus(rec({ instaStatus: "confirming" }), true).label, "Awaiting their confirmation");
  assert.equal(describeInstaStatus(rec({ instaStatus: "suppressed" }), true).tone, "muted");
  assert.equal(describeInstaStatus(rec({ instaStatus: "synced", unsubscribedAt: when }), true).label, "Removal pending");
  assert.equal(describeInstaStatus(rec({ instaStatus: "removed", unsubscribedAt: when }), true).label, "Removed from Insta-Newsletter");
  assert.equal(describeInstaStatus(rec({ instaStatus: null, unsubscribedAt: when }), true).label, "Unsubscribed");
});

test("the cron only touches rows whose website state and Insta-Newsletter state disagree", () => {
  assert.equal(needsPush(rec({ instaStatus: null })), "subscribe");
  assert.equal(needsPush(rec({ instaStatus: "queued" })), "subscribe");
  assert.equal(needsPush(rec({ instaStatus: "removed" })), "subscribe", "re-subscribed on the website after a removal");
  assert.equal(needsPush(rec({ instaStatus: "synced" })), null);
  assert.equal(needsPush(rec({ instaStatus: "failed" })), null, "a permanent refusal is not retried blindly");
  assert.equal(needsPush(rec({ instaStatus: "suppressed" })), null, "they left Insta-Newsletter; only their own click brings them back");
  assert.equal(needsPush(rec({ instaStatus: "synced", unsubscribedAt: when })), "unsubscribe");
  assert.equal(needsPush(rec({ instaStatus: "confirming", unsubscribedAt: when })), "unsubscribe");
  assert.equal(needsPush(rec({ instaStatus: "removed", unsubscribedAt: when })), null);
  assert.equal(needsPush(rec({ instaStatus: null, unsubscribedAt: when })), null);
});

test("filters, summary and the Insta-Newsletter-friendly CSV", () => {
  const rows = [cc, hh, rec({ id: 3, email: "cara@example.com", unsubscribedAt: when, instaStatus: "removed" }), rec({ id: 4, email: "dan@example.com", instaStatus: "failed", instaError: "x" }), rec({ id: 5, email: "eve@example.com", instaStatus: "synced", createdAt: new Date("2020-01-01") })];
  assert.deepEqual(filterSubscribers(rows, {}).map((r) => r.email), ["ann@example.com", "bob@example.com", "dan@example.com", "eve@example.com"], "active by default");
  assert.deepEqual(filterSubscribers(rows, { status: "unsubscribed" }).map((r) => r.email), ["cara@example.com"]);
  assert.deepEqual(filterSubscribers(rows, { status: "attention" }).map((r) => r.email), ["ann@example.com", "bob@example.com", "dan@example.com"], "never sent, retrying or failed");
  assert.deepEqual(filterSubscribers(rows, { audience: "healthy-home", status: "all" }).map((r) => r.email), ["bob@example.com"]);
  assert.deepEqual(filterSubscribers(rows, { q: "kingston", status: "all" }).map((r) => r.id), [1, 3, 4, 5]);
  assert.deepEqual(filterSubscribers(rows, { audience: "bogus", status: "all" }).length, 5, "an unknown list filter is ignored, not an empty page");
  const s = summarizeSubscribers(rows, new Date("2026-11-01T00:00:00Z"));
  assert.equal(s.active, 4); assert.equal(s.byAudience["caribbean-connection"], 3); assert.equal(s.byAudience["healthy-home"], 1);
  assert.equal(s.synced, 1); assert.equal(s.waiting, 2); assert.equal(s.failed, 1); assert.equal(s.newLast30Days, 4);
  const csv = subscribersCsv([cc, rows[2]]).split("\n");
  assert.equal(csv[0], "email,first_name,last_name,status,audience,segment,location,country,source,consented_at,unsubscribed_at,insta_newsletter");
  assert.equal(csv[1], 'ann@example.com,,,active,Caribbean Connection,Living in Jamaica,"Kingston, Jamaica",Jamaica,caribbean-newsletter,2026-10-31T19:00:00.000Z,,not sent');
  assert.match(csv[2], /^cara@example.com,,,unsubscribed,/, "a suppression travels in the status column Insta-Newsletter's import honours");
});

test("pasted addresses and keys are tidied before they are used", () => {
  assert.equal(normalizeInstaUrl("insta-newsletter.com"), "https://insta-newsletter.com");
  assert.equal(normalizeInstaUrl("https://insta-newsletter.com/v1/"), "https://insta-newsletter.com");
  assert.equal(normalizeInstaUrl("https://app.example.com/settings?tab=developers"), "https://app.example.com");
  assert.equal(normalizeInstaUrl("http://localhost:5000"), "http://localhost:5000");
  assert.equal(normalizeInstaUrl("http://insta-newsletter.com"), null, "plain http to a real host is refused");
  assert.equal(normalizeInstaUrl("not a url"), null);
  assert.equal(normalizeInstaUrl(""), null);
  assert.equal(looksLikeInstaApiKey("inl_abcdefghijklmnopqrstuvwxyz0123456789ABCD"), true);
  assert.equal(looksLikeInstaApiKey("whsec_abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(looksLikeInstaApiKey("inl_short"), false);
  assert.deepEqual(missingInstaScopes(["subscribers:write", "audiences:read", "audiences:write"]), []);
  assert.deepEqual(missingInstaScopes(["subscribers:read"]), ["subscribers:write", "audiences:read"]);
  assert.deepEqual(instaLinks("https://insta-newsletter.com/"), { home: "https://insta-newsletter.com", contacts: "https://insta-newsletter.com/contacts", newsletters: "https://insta-newsletter.com/newsletters", campaigns: "https://insta-newsletter.com/campaigns", developers: "https://insta-newsletter.com/settings" });
  assert.equal(instaLinks("").home, "");
});
