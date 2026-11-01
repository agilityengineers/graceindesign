import { test } from "node:test";
import assert from "node:assert/strict";
import { asinFromUrl, amazonCartUrl, withAssociateTag, retailerFor, amazonImageUrl, isRetailer, asRetailer } from "../src/lib/retailers";
import { signingKey, signRequest } from "../src/lib/server/amazon";

test("ASINs are read from the common Amazon link shapes and from nothing else", () => {
  assert.equal(asinFromUrl("https://www.amazon.com/CIVAGO-Bottle/dp/B0CXYZ1234/ref=sr_1_1?keywords=x"), "B0CXYZ1234");
  assert.equal(asinFromUrl("https://www.amazon.com/gp/product/b0cxyz1234"), "B0CXYZ1234");
  assert.equal(asinFromUrl("https://amazon.co.uk/gp/aw/d/B0CXYZ1234?psc=1"), "B0CXYZ1234");
  assert.equal(asinFromUrl("https://www.amazon.com/dp/B0CXYZ1234"), "B0CXYZ1234");
  assert.equal(asinFromUrl("https://www.amazon.com/s?k=resistance+bands"), null);
  assert.equal(asinFromUrl("https://amzn.to/3abc"), null);
  assert.equal(asinFromUrl("https://www.etsy.com/listing/4548113647/x"), null);
});

test("a cart link carries the tracking id and one ASIN/quantity pair per item", () => {
  const u = new URL(amazonCartUrl(["B0CXYZ1234", "B0ABCDEFGH"], "graceindesign-20"));
  assert.equal(u.origin + u.pathname, "https://www.amazon.com/gp/aws/cart/add.html");
  assert.equal(u.searchParams.get("AssociateTag"), "graceindesign-20");
  assert.equal(u.searchParams.get("ASIN.1"), "B0CXYZ1234");
  assert.equal(u.searchParams.get("Quantity.1"), "1");
  assert.equal(u.searchParams.get("ASIN.2"), "B0ABCDEFGH");
  assert.equal(u.searchParams.get("Quantity.2"), "1");
  assert.equal(new URL(amazonCartUrl(["B0CXYZ1234"], "t-20", "www.amazon.ca")).hostname, "www.amazon.ca");
});

test("the tracking id is added to Amazon product links only, and never twice", () => {
  assert.equal(withAssociateTag("https://www.amazon.com/dp/B0CXYZ1234", "t-20"), "https://www.amazon.com/dp/B0CXYZ1234?tag=t-20");
  assert.equal(withAssociateTag("https://www.amazon.com/dp/B0CXYZ1234?tag=other-20", "t-20"), "https://www.amazon.com/dp/B0CXYZ1234?tag=other-20");
  assert.equal(withAssociateTag("https://www.etsy.com/listing/1", "t-20"), "https://www.etsy.com/listing/1");
  assert.equal(withAssociateTag("https://amzn.to/3abc", "t-20"), "https://amzn.to/3abc");
  assert.equal(withAssociateTag("https://www.amazon.com/dp/B0CXYZ1234", ""), "https://www.amazon.com/dp/B0CXYZ1234");
  assert.equal(retailerFor("https://amzn.to/3abc"), "amazon");
  assert.equal(retailerFor("https://www.amazon.co.uk/dp/B0CXYZ1234"), "amazon");
});

test("the Signature V4 signing key matches the AWS reference example", () => {
  // "Deriving the signing key" example from the AWS Signature Version 4 documentation.
  assert.equal(signingKey("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20150830", "us-east-1", "iam").toString("hex"), "c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9");
});

test("a Product Advertising API request is signed the way an independent implementation signs it", () => {
  // Expected values were produced separately with Python's hmac/hashlib for the same inputs.
  const h = signRequest({ accessKey: "AKIDEXAMPLE", secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", host: "webservices.amazon.com", region: "us-east-1", path: "/paapi5/getitems", target: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems", body: '{"ItemIds":["B000000000"],"PartnerTag":"test-20"}', now: new Date("2026-01-02T03:04:05Z") });
  assert.equal(h["x-amz-date"], "20260102T030405Z");
  assert.equal(h["content-encoding"], "amz-1.0");
  assert.equal(h.host, "webservices.amazon.com");
  assert.equal(h.authorization, "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260102/us-east-1/ProductAdvertisingAPI/aws4_request, SignedHeaders=content-encoding;content-type;host;x-amz-date;x-amz-target, Signature=fcf1ec44deebb07769cc8c20e142612f5a3c02d07042844581cc5e5cecf0b258");
});

test("the image-by-ASIN address is upper-cased and sized; store keys are checked strictly", () => {
  assert.equal(amazonImageUrl("b0cxyz1234"), "https://images-na.ssl-images-amazon.com/images/P/B0CXYZ1234.01._SL500_.jpg");
  assert.equal(amazonImageUrl("B0CXYZ1234", 160), "https://images-na.ssl-images-amazon.com/images/P/B0CXYZ1234.01._SL160_.jpg");
  assert.equal(isRetailer("amazon"), true);
  assert.equal(isRetailer("etsy"), true);
  assert.equal(isRetailer("other"), true);
  assert.equal(isRetailer(""), false); // "Detect from the link" on the add form
  assert.equal(isRetailer("walmart"), false);
  assert.equal(asRetailer("walmart"), "other");
});
