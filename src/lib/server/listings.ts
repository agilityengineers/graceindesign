// server-only (also used by scripts/cron.ts and scripts/import-products.ts)
/**
 * Listing details from a store's public product page: Open Graph metadata, plus Amazon's own page markup. No API keys.
 * Amazon answers automated requests inconsistently (a bot-check page or HTTP 503); when it does, the admin fills the card in by hand.
 */
import { eq } from "drizzle-orm";
import { db, products } from "@/lib/db";
import { asinFromUrl, isListingUrl, isOwnImage, retailerFor, RETAILERS } from "@/lib/retailers";
import { getAmazonItems, paapiReady, type AmazonItem } from "@/lib/server/amazon";
export * from "@/lib/retailers";

export type ListingDetails = { title: string; price: string; image: string | null; reviews: string; description: string | null; rating?: string | null };
const fromAmazon = (it: AmazonItem): ListingDetails => ({ title: it.title, price: it.price, image: it.image, reviews: it.reviews, description: it.description, rating: it.rating });

const decode = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const cut = (s: string, n = 400) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, "")}…`);
const UA_BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const UA_BOT = "Mozilla/5.0 (compatible; GraceInDesignBot/1.0)";

/** Title, price, photo, rating and description for a listing: the Product Advertising API for Amazon items when it is configured, otherwise the public page. */
export async function fetchListing(url: string, opts: { viaApi?: boolean } = {}): Promise<ListingDetails | null> {
  if (!isListingUrl(url)) return null;
  const retailer = retailerFor(url);
  if (retailer === "amazon") {
    const asin = asinFromUrl(url);
    if (asin && opts.viaApi !== false && (await paapiReady())) {
      try { const [it] = await getAmazonItems([asin]); if (it) return fromAmazon(it); } catch (e) { console.warn("Amazon API:", (e as Error).message); }
    }
    if (/^\/s\/?$/.test(new URL(url).pathname)) return null; // a search page, not a listing: nothing reliable to read
  }
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": retailer === "amazon" ? UA_BROWSER : UA_BOT, accept: "text/html,application/xhtml+xml", "accept-language": "en-US,en;q=0.9" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i"))?.[1] || null;
    const first = (...res: RegExp[]) => { for (const re of res) { const m = html.match(re); if (m?.[1]) return m[1]; } return null; };
    if (retailer === "amazon" && !/id="productTitle"/.test(html) && /captcha|robot check|Type the characters/i.test(html)) return null;

    let title = decode(first(/<span[^>]+id="productTitle"[^>]*>([\s\S]*?)<\/span>/i) || meta("og:title") || first(/<title>([^<]+)<\/title>/i) || "");
    title = title.replace(/\s*[-|]\s*Etsy.*$/i, "").replace(/^Amazon\.com\s*:\s*/i, "").replace(/\s*[-|:]\s*Amazon\.com.*$/i, "").trim();
    const amount = meta("product:price:amount") || first(/"priceAmount"\s*:\s*"?([\d.]+)/, /class="a-offscreen">\$([\d,]+\.\d{2})</, /"price"\s*:\s*"?([\d.]+)"?/);
    const price = amount ? `$${Number(String(amount).replace(/,/g, "")).toFixed(2)}` : "$—";
    const image = first(/"hiRes"\s*:\s*"(https:[^"]+)"/, /id="landingImage"[^>]+data-old-hires="(https:[^"]+)"/, /id="landingImage"[^>]+src="(https:[^"]+)"/) || meta("og:image");
    const reviews = first(/id="acrCustomerReviewText"[^>]*>\s*([\d,]+)\s+(?:global\s+)?ratings?/i, /([\d,]+)\s+reviews?/i);
    let description = retailer === "amazon" ? decode(first(/id="feature-bullets"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i) || "") : "";
    if (!description) description = decode(meta("og:description") || meta("description") || "");
    if (/^Amazon\.com/i.test(description)) description = "";
    return { title: title || `${RETAILERS[retailer].name} listing`, price, image: image ? decode(image) : null, reviews: reviews ? `(${reviews})` : "(0)", description: description ? cut(description) : null };
  } catch { return null; }
}

/** What an explicit "Refresh" takes from the store page: everything except a photo uploaded here or a description typed here. */
export function refreshedFields(p: { title: string; price: string; imageUrl: string | null; reviews: string; description: string | null; rating?: string }, d: ListingDetails) {
  return { title: d.title || p.title, price: d.price !== "$—" ? d.price : p.price, imageUrl: isOwnImage(p.imageUrl) ? p.imageUrl : d.image || p.imageUrl, reviews: d.reviews !== "(0)" ? d.reviews : p.reviews, description: p.description || d.description, rating: d.rating || p.rating, lastSyncedAt: new Date() };
}

/** Scheduled refresh of every visible listing: price, rating and the photo (unless one was uploaded). Titles and descriptions belong to the admin. */
export async function syncProducts() {
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  // Amazon items with an ASIN go through the API in batches of ten when it is configured; everything else reads its page.
  const viaApi = new Map<number, ListingDetails>();
  if (await paapiReady()) {
    const amazon = rows.map((p) => ({ p, asin: p.retailer === "amazon" ? asinFromUrl(p.url) : null })).filter((x): x is { p: (typeof rows)[number]; asin: string } => !!x.asin);
    try { const items = await getAmazonItems(amazon.map((x) => x.asin)); for (const x of amazon) { const it = items.find((i) => i.asin === x.asin); if (it) viaApi.set(x.p.id, fromAmazon(it)); } }
    catch (e) { console.warn("Amazon API:", (e as Error).message); }
  }
  let updated = 0;
  for (let i = 0; i < rows.length; i += 4) { // four store pages at a time keeps a 20-item catalog under a minute
    await Promise.all(rows.slice(i, i + 4).map(async (p) => {
      const d = viaApi.get(p.id) ?? (await fetchListing(p.url, { viaApi: false }));
      if (!d) return;
      await db.update(products).set({ price: d.price !== "$—" ? d.price : p.price, imageUrl: isOwnImage(p.imageUrl) ? p.imageUrl : d.image || p.imageUrl, reviews: d.reviews !== "(0)" ? d.reviews : p.reviews, rating: d.rating || p.rating, description: p.description || d.description, lastSyncedAt: new Date() }).where(eq(products.id, p.id));
      updated++;
    }));
  }
  return updated;
}
