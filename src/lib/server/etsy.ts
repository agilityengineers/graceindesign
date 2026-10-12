// server-only (also used by scripts/cron.ts)
/** Etsy listing import: scrape Open Graph metadata from the listing page (no API key needed). */
import { eq } from "drizzle-orm";
import { db, products } from "@/lib/db";

export async function fetchEtsyListing(url: string): Promise<{ title: string; price: string; image: string | null; reviews: string } | null> {
  try {
    const u = new URL(url); if (!/etsy\.com$/.test(u.hostname.replace(/^www\./, ""))) return null;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; GraceInDesignBot/1.0)", accept: "text/html" } });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i"))?.[1] || null;
    const title = (meta("og:title") || html.match(/<title>([^<]+)<\/title>/i)?.[1] || "Etsy listing").replace(/\s*[-|]\s*Etsy.*$/i, "").trim();
    const amount = meta("product:price:amount") || html.match(/"price"\s*:\s*"?([\d.]+)"?/)?.[1];
    const reviews = html.match(/([\d,]+)\s+reviews?/i)?.[1];
    return { title: decode(title), price: amount ? `$${Number(amount).toFixed(2)}` : "$—", image: meta("og:image"), reviews: reviews ? `(${reviews})` : "(0)" };
  } catch { return null; }
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function syncEtsyProducts() {
  const rows = await db.select().from(products).where(eq(products.isActive, true));
  let updated = 0;
  for (const p of rows) {
    const d = await fetchEtsyListing(p.etsyUrl);
    if (!d) continue;
    await db.update(products).set({ title: d.title || p.title, price: d.price !== "$—" ? d.price : p.price, imageUrl: p.imageUrl?.startsWith("media://") ? p.imageUrl : d.image || p.imageUrl, reviews: d.reviews !== "(0)" ? d.reviews : p.reviews, lastSyncedAt: new Date() }).where(eq(products.id, p.id));
    updated++;
  }
  return updated;
}
