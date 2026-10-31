// server-only (also used by scripts/cron.ts)
/**
 * Amazon shop: the Associates tracking id (links + "Add to Amazon cart") and the Product Advertising API 5 (live product search and
 * details). Think of the API as the store's catalog desk: ask it for an ASIN or some keywords and it answers with the title, photo,
 * price and feature bullets. It needs an Associates account that qualifies for API access and the keys in AMAZON_PAAPI_ACCESS_KEY /
 * AMAZON_PAAPI_SECRET_KEY; without them, listings fall back to reading the public product page (src/lib/server/listings.ts).
 * Requests are signed with AWS Signature Version 4 directly (no SDK): https://webservices.amazon.com/paapi5/documentation/
 */
import { createHash, createHmac } from "crypto";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/server/settings";
import { AMAZON_MARKETPLACE_DEFAULT } from "@/lib/retailers";

/** API host and signing region per storefront. */
const ENDPOINTS: Record<string, { host: string; region: string }> = {
  "www.amazon.com": { host: "webservices.amazon.com", region: "us-east-1" },
  "www.amazon.ca": { host: "webservices.amazon.ca", region: "us-east-1" },
  "www.amazon.com.mx": { host: "webservices.amazon.com.mx", region: "us-east-1" },
  "www.amazon.com.br": { host: "webservices.amazon.com.br", region: "us-east-1" },
  "www.amazon.co.uk": { host: "webservices.amazon.co.uk", region: "eu-west-1" },
  "www.amazon.de": { host: "webservices.amazon.de", region: "eu-west-1" },
  "www.amazon.fr": { host: "webservices.amazon.fr", region: "eu-west-1" },
  "www.amazon.it": { host: "webservices.amazon.it", region: "eu-west-1" },
  "www.amazon.es": { host: "webservices.amazon.es", region: "eu-west-1" },
  "www.amazon.in": { host: "webservices.amazon.in", region: "eu-west-1" },
  "www.amazon.co.jp": { host: "webservices.amazon.co.jp", region: "us-west-2" },
  "www.amazon.com.au": { host: "webservices.amazon.com.au", region: "us-west-2" },
};
const SERVICE = "ProductAdvertisingAPI";
const RESOURCES = ["ItemInfo.Title", "ItemInfo.Features", "ItemInfo.ByLineInfo", "Images.Primary.Large", "Offers.Listings.Price", "CustomerReviews.Count", "CustomerReviews.StarRating"];

export type AmazonShop = { tag: string; cartButtons: boolean; marketplace: string };
/** The tracking id (Site settings → Amazon shop, else AMAZON_ASSOCIATE_TAG), whether cart buttons are on, and the storefront. */
export async function getAmazonShop(): Promise<AmazonShop> {
  const s = await getSetting("amazon");
  return { tag: (s.associateTag || env.amazon.partnerTag).trim(), cartButtons: s.cartButtons !== false, marketplace: env.amazon.marketplace || AMAZON_MARKETPLACE_DEFAULT };
}
/** True when the Product Advertising API can be called (both keys and a tracking id). */
export async function paapiReady() { return !!(env.amazon.accessKey && env.amazon.secretKey && (await getAmazonShop()).tag); }

// --- AWS Signature Version 4 ----------------------------------------------------------------------------------------------
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s, "utf8").digest();
export function signingKey(secret: string, date: string, region: string, service: string) { return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request"); }
/** Headers for a signed PA-API POST. `host` is included in the signature but set by fetch itself. */
export function signRequest(o: { accessKey: string; secretKey: string; host: string; region: string; path: string; target: string; body: string; now?: Date }): Record<string, string> {
  const amzDate = (o.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const date = amzDate.slice(0, 8);
  const headers: Record<string, string> = { "content-encoding": "amz-1.0", "content-type": "application/json; charset=utf-8", host: o.host, "x-amz-date": amzDate, "x-amz-target": o.target };
  const names = Object.keys(headers).sort();
  const canonical = ["POST", o.path, "", names.map((k) => `${k}:${headers[k].trim()}\n`).join(""), names.join(";"), sha256(o.body)].join("\n");
  const scope = `${date}/${o.region}/${SERVICE}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signature = createHmac("sha256", signingKey(o.secretKey, date, o.region, SERVICE)).update(toSign, "utf8").digest("hex");
  return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${o.accessKey}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` };
}

// --- Product Advertising API 5 -------------------------------------------------------------------------------------------------
export type AmazonItem = { asin: string; url: string; title: string; price: string; image: string | null; reviews: string; rating: string | null; description: string | null; byline: string | null };

async function call(op: "SearchItems" | "GetItems", payload: Record<string, unknown>) {
  const shop = await getAmazonShop();
  if (!env.amazon.accessKey || !env.amazon.secretKey) throw new Error("Amazon Product Advertising API keys are not set (AMAZON_PAAPI_ACCESS_KEY / AMAZON_PAAPI_SECRET_KEY)");
  if (!shop.tag) throw new Error("Set the Associates tracking id first (Site settings → Amazon shop)");
  const ep = ENDPOINTS[shop.marketplace] || ENDPOINTS[AMAZON_MARKETPLACE_DEFAULT];
  const path = `/paapi5/${op.toLowerCase()}`;
  const body = JSON.stringify({ PartnerTag: shop.tag, PartnerType: "Associates", Marketplace: shop.marketplace, Resources: RESOURCES, ...payload });
  const { host: _host, ...headers } = signRequest({ accessKey: env.amazon.accessKey, secretKey: env.amazon.secretKey, host: ep.host, region: ep.region, path, target: `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${op}`, body });
  void _host;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  const res = await fetch(`https://${ep.host}${path}`, { method: "POST", headers, body, signal: ctrl.signal }).finally(() => clearTimeout(t));
  const json: any = await res.json().catch(() => ({}));
  const err = json?.Errors?.[0];
  if (err && err.Code !== "NoResults") throw new Error(`Amazon API: ${err.Code} — ${err.Message || ""}`.trim());
  if (!res.ok && !err) throw new Error(`Amazon API answered HTTP ${res.status}`);
  return json;
}

function toItem(it: any): AmazonItem | null {
  const asin = String(it?.ASIN || "").toUpperCase(); if (!/^[A-Z0-9]{10}$/.test(asin)) return null;
  const price = it?.Offers?.Listings?.[0]?.Price; const amount = typeof price?.Amount === "number" ? price.Amount : null;
  const features: string[] = it?.ItemInfo?.Features?.DisplayValues || [];
  const count = it?.CustomerReviews?.Count; const stars = it?.CustomerReviews?.StarRating?.Value;
  return {
    asin, url: it?.DetailPageURL || `https://${env.amazon.marketplace || AMAZON_MARKETPLACE_DEFAULT}/dp/${asin}`,
    title: it?.ItemInfo?.Title?.DisplayValue || `Amazon item ${asin}`,
    price: amount != null ? `$${amount.toFixed(2)}` : price?.DisplayAmount || "$—",
    image: it?.Images?.Primary?.Large?.URL || null,
    reviews: typeof count === "number" ? `(${count.toLocaleString("en-US")})` : "(0)",
    rating: typeof stars === "number" ? stars.toFixed(1) : null,
    description: features.length ? features.map((f) => f.replace(/\s+/g, " ").trim()).join(" ").slice(0, 400) : null,
    byline: it?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || it?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue || null,
  };
}

/** Keyword search (one page of up to 10 items). */
export async function searchAmazon(keywords: string, page = 1): Promise<{ items: AmazonItem[]; total: number }> {
  const json = await call("SearchItems", { Keywords: keywords.trim().slice(0, 150), SearchIndex: "All", ItemCount: 10, ItemPage: Math.max(1, Math.min(10, page)) });
  const items = ((json?.SearchResult?.Items || []) as unknown[]).map(toItem).filter((x): x is AmazonItem => !!x);
  return { items, total: Number(json?.SearchResult?.TotalResultCount || items.length) };
}

/** Details for up to 10 ASINs per call (more are batched). */
export async function getAmazonItems(asins: string[]): Promise<AmazonItem[]> {
  const ids = Array.from(new Set(asins.map((a) => a.toUpperCase()).filter((a) => /^[A-Z0-9]{10}$/.test(a))));
  const out: AmazonItem[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const json = await call("GetItems", { ItemIds: ids.slice(i, i + 10), ItemIdType: "ASIN" });
    out.push(...((json?.ItemsResult?.Items || []) as unknown[]).map(toItem).filter((x): x is AmazonItem => !!x));
  }
  return out;
}
