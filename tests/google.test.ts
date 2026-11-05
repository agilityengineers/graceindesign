import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOOGLE_DEFAULTS, normalizeGaId, normalizeGtmId, normalizeSearchConsoleToken, normalizePlaceId, normalizeProfileUrl, normalizeMapEmbedUrl,
  reviewUrl, trackedProfileWebsiteUrl, safeGaId, safeGtmId, safeMapEmbedUrl, buildLocalBusinessJsonLd, jsonLdString,
} from "../src/lib/google";

test("GA4 and Tag Manager IDs: Google's shapes only, tidied up", () => {
  assert.deepEqual(normalizeGaId(" g-abc123xyz9 "), { value: "G-ABC123XYZ9" });
  assert.deepEqual(normalizeGaId(""), { value: "" });
  assert.ok(normalizeGaId("UA-12345-1").error);
  assert.ok(normalizeGaId("G-ABC');alert(1)//").error);
  assert.deepEqual(normalizeGtmId("gtm-ab12cd3"), { value: "GTM-AB12CD3" });
  assert.ok(normalizeGtmId("GTM-AB12CD3\"><script>").error);
  assert.equal(safeGaId("G-ABC'+x"), "");
  assert.equal(safeGtmId("GTM-AB12CD3"), "GTM-AB12CD3");
});

test("Search Console: the whole meta tag or just the code", () => {
  const code = "aBcD_1234-efGH5678ijkl9012mnop";
  assert.equal(normalizeSearchConsoleToken(`<meta name="google-site-verification" content="${code}" />`).value, code);
  assert.equal(normalizeSearchConsoleToken(code).value, code);
  assert.ok(normalizeSearchConsoleToken(`<meta content="bad code with spaces">`).error);
});

test("Business Profile link: https Google hosts only", () => {
  assert.equal(normalizeProfileUrl("https://maps.app.goo.gl/AbC123").value, "https://maps.app.goo.gl/AbC123");
  assert.ok(!normalizeProfileUrl("https://www.google.com/maps/place/Grace+In+Design").error);
  assert.ok(!normalizeProfileUrl("https://g.page/r/abc").error);
  assert.ok(normalizeProfileUrl("http://maps.app.goo.gl/AbC123").error);
  assert.ok(normalizeProfileUrl("https://google.com.evil.example/maps").error);
  assert.ok(normalizeProfileUrl("javascript:alert(1)").error);
});

test("Map embed: iframe code or src, only google.com/maps/embed", () => {
  const src = "https://www.google.com/maps/embed?pb=!1m18!1m12&amp;x=1";
  assert.equal(normalizeMapEmbedUrl(`<iframe src="${src}" width="600"></iframe>`).value, "https://www.google.com/maps/embed?pb=!1m18!1m12&x=1");
  assert.ok(normalizeMapEmbedUrl("https://www.google.com/maps/place/x").error);
  assert.ok(normalizeMapEmbedUrl("https://evil.example/maps/embed").error);
  assert.equal(safeMapEmbedUrl("https://evil.example/maps/embed"), "");
});

test("Place ID, review link and tracked website link", () => {
  assert.equal(normalizePlaceId(" ChIJN1t_tDeuEmsRUsoyG83frY4 ").value, "ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.ok(normalizePlaceId("ChIJ x y").error);
  assert.equal(reviewUrl("ChIJabc"), "https://search.google.com/local/writereview?placeid=ChIJabc");
  assert.equal(reviewUrl(""), "");
  const u = new URL(trackedProfileWebsiteUrl("https://graceindesign.net"));
  assert.equal(u.searchParams.get("utm_source"), "google");
  assert.equal(u.searchParams.get("utm_campaign"), "business_profile");
});

test("business data matches the profile and can hide the street", () => {
  const base = { baseUrl: "https://graceindesign.net/", name: "Grace In Design", description: "Interior design", phone: "(770) 691-1600", email: "support@graceindesign.net", logoPath: "/assets/logo.png", sameAs: ["https://facebook.com/graceindesign", "", "http://insecure.example"] };
  const google = { ...GOOGLE_DEFAULTS, profileUrl: "https://maps.app.goo.gl/AbC", streetAddress: "1 Peachtree St", postalCode: "30303", areaServed: "Atlanta, Decatur", openingHours: "Mo-Fr 09:00-17:00; Sa 10:00-14:00" };
  const d = buildLocalBusinessJsonLd({ ...base, google }) as any;
  assert.equal(d["@type"], "HomeAndConstructionBusiness");
  assert.equal(d.url, "https://graceindesign.net/");
  assert.equal(d.address.streetAddress, "1 Peachtree St");
  assert.equal(d.address.addressLocality, "Atlanta");
  assert.deepEqual(d.openingHours, ["Mo-Fr 09:00-17:00", "Sa 10:00-14:00"]);
  assert.deepEqual(d.areaServed.map((a: any) => a.name), ["Atlanta", "Decatur"]);
  assert.deepEqual(d.sameAs, ["https://maps.app.goo.gl/AbC", "https://facebook.com/graceindesign"]);
  assert.equal(d.hasMap, "https://maps.app.goo.gl/AbC");
  const hidden = buildLocalBusinessJsonLd({ ...base, google: { ...google, hideStreet: true } }) as any;
  assert.equal(hidden.address.streetAddress, undefined);
  assert.equal(hidden.address.postalCode, "30303");
});

test("JSON-LD output can never close its script tag", () => {
  const s = jsonLdString({ name: "</script><script>alert(1)</script>" });
  assert.ok(!s.includes("</script>"));
  assert.deepEqual(JSON.parse(s), { name: "</script><script>alert(1)</script>" });
});
