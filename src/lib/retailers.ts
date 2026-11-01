/** Which store a product link opens on. Client-safe: no database, no network. */
export type Retailer = "etsy" | "amazon" | "other";

export const RETAILERS: Record<Retailer, { name: string; on: string; dot: string }> = {
  etsy: { name: "Etsy", on: "Etsy", dot: "#f1641e" },
  amazon: { name: "Amazon", on: "Amazon", dot: "#ff9900" },
  other: { name: "Other store", on: "the store", dot: "#6cb6e6" },
};
export const RETAILER_KEYS = Object.keys(RETAILERS) as Retailer[];

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

export function isListingUrl(url: string) { return /^https?:\/\//i.test(url) && hostOf(url).includes("."); }

export function retailerFor(url: string): Retailer {
  const h = hostOf(url);
  if (h === "etsy.com" || h.endsWith(".etsy.com") || h === "etsy.me") return "etsy";
  if (/(^|\.)amazon\.[a-z.]{2,6}$/.test(h) || ["amzn.to", "amzn.com", "amzn.eu", "amzn.asia", "a.co"].includes(h)) return "amazon";
  return "other";
}

export function asRetailer(v: string | null | undefined): Retailer { return (RETAILER_KEYS as string[]).includes(v || "") ? (v as Retailer) : "other"; }
/** True only for a known store key (unlike `asRetailer`, which maps anything unknown to "other"). */
export function isRetailer(v: unknown): v is Retailer { return typeof v === "string" && (RETAILER_KEYS as string[]).includes(v); }

/** "Amazon" / "Etsy" / "the store", for "View on …" and "… reviews on …". */
export function retailerLabel(v: string | null | undefined) { return RETAILERS[asRetailer(v)].on; }

/** The small blue line beside the price when the admin leaves `type` blank. */
export function defaultType(r: Retailer) { return r === "etsy" ? "Digital download" : ""; }

/** Uploaded or self-hosted photos survive a refresh from the store; remote ones are replaced. */
export function isOwnImage(url: string | null | undefined) { return !!url && !/^https?:\/\//i.test(url); }

export const AMAZON_MARKETPLACE_DEFAULT = "www.amazon.com";

/** Amazon's image-by-ASIN address for a listing's primary photo (no API key). Amazon answers an unknown ASIN with a tiny placeholder, so callers check the response before adopting it. */
export function amazonImageUrl(asin: string, size = 500) { return `https://images-na.ssl-images-amazon.com/images/P/${asin.toUpperCase()}.01._SL${size}_.jpg`; }

/** ASIN from an Amazon product link (/dp/…, /gp/product/…, /gp/aw/d/…, ?asin=…). Short links (amzn.to, a.co) and search pages carry none. */
export function asinFromUrl(url: string): string | null {
  if (retailerFor(url) !== "amazon") return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Za-z0-9]{10})(?:[/?]|$)/);
    const a = (m?.[1] || u.searchParams.get("asin") || "").toUpperCase();
    return /^[A-Z0-9]{10}$/.test(a) ? a : null;
  } catch { return null; }
}

/** Amazon Associates "Add to Cart" link: one click puts every ASIN (quantity 1) in the visitor's Amazon cart on Amazon's site. */
export function amazonCartUrl(asins: string[], tag: string, marketplace = AMAZON_MARKETPLACE_DEFAULT) {
  const u = new URL(`https://${marketplace}/gp/aws/cart/add.html`);
  if (tag) u.searchParams.set("AssociateTag", tag);
  asins.forEach((a, i) => { u.searchParams.set(`ASIN.${i + 1}`, a); u.searchParams.set(`Quantity.${i + 1}`, "1"); });
  return u.toString();
}

/** Adds the Associates tracking id to an Amazon product link that does not carry one (short links are left alone). */
export function withAssociateTag(url: string, tag: string) {
  if (!tag || retailerFor(url) !== "amazon") return url;
  try {
    const u = new URL(url);
    if (u.searchParams.has("tag") || ["amzn.to", "a.co", "amzn.eu", "amzn.asia"].includes(u.hostname)) return url;
    u.searchParams.set("tag", tag);
    return u.toString();
  } catch { return url; }
}
