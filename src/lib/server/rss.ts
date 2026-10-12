// server-only (also used by scripts/cron.ts)
/** RSS/Atom import for News & Insights and Caribbean regional sources. */
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import { db, rssSources, posts } from "@/lib/db";
import { slugify } from "@/lib/utils";

type Item = { title: string; link: string; guid: string; date: Date | null; summary: string; image: string | null; category: string | null };

export function parseFeed(xml: string): { title: string; items: Item[] } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", cdataPropName: "__cdata" });
  const doc = parser.parse(xml);
  const txt = (v: any): string => { if (v == null) return ""; if (typeof v === "string") return v; if (typeof v === "number") return String(v); if (Array.isArray(v)) return txt(v[0]); return txt(v.__cdata ?? v["#text"] ?? v["@_href"] ?? ""); };
  const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const firstImg = (html: string) => { const m = html.match(/<img[^>]+src=["']([^"']+)["']/i); return m ? m[1] : null; };
  if (doc.rss?.channel) {
    const ch = doc.rss.channel; const list = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
    return { title: txt(ch.title), items: list.map((it: any): Item => { const desc = txt(it["content:encoded"]) || txt(it.description); const enc = it.enclosure?.["@_url"] || it["media:content"]?.["@_url"] || it["media:thumbnail"]?.["@_url"]; return { title: strip(txt(it.title)), link: txt(it.link), guid: txt(it.guid) || txt(it.link), date: it.pubDate ? new Date(txt(it.pubDate)) : null, summary: strip(desc).slice(0, 400), image: enc || firstImg(desc), category: txt(Array.isArray(it.category) ? it.category[0] : it.category) || null }; }) };
  }
  if (doc.feed) {
    const f = doc.feed; const list = Array.isArray(f.entry) ? f.entry : f.entry ? [f.entry] : [];
    return { title: txt(f.title), items: list.map((e: any): Item => { const links = Array.isArray(e.link) ? e.link : [e.link]; const alt = links.find((l: any) => !l?.["@_rel"] || l["@_rel"] === "alternate") || links[0]; const html = txt(e.content) || txt(e.summary); return { title: strip(txt(e.title)), link: alt?.["@_href"] || txt(alt), guid: txt(e.id) || alt?.["@_href"], date: e.published || e.updated ? new Date(txt(e.published || e.updated)) : null, summary: strip(html).slice(0, 400), image: firstImg(html), category: e.category?.["@_term"] || null }; }) };
  }
  return { title: "", items: [] };
}

export async function syncRssSource(id: number): Promise<{ imported: number; error?: string }> {
  const src = await db.query.rssSources.findFirst({ where: eq(rssSources.id, id) });
  if (!src || !src.isActive) return { imported: 0 };
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(src.url, { signal: ctrl.signal, headers: { "user-agent": "GraceInDesign-RSS/1.0", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { items } = parseFeed(await res.text());
    let imported = 0;
    for (const it of items.slice(0, 30)) {
      if (!it.title || !it.guid) continue;
      const guid = `rss:${src.id}:${it.guid}`.slice(0, 500);
      const exists = await db.query.posts.findFirst({ where: eq(posts.guid, guid), columns: { id: true } });
      if (exists) continue;
      const baseSlug = slugify(it.title) || `item-${Date.now()}`;
      let slug = baseSlug; let n = 1;
      while (await db.query.posts.findFirst({ where: eq(posts.slug, slug), columns: { id: true } })) slug = `${baseSlug}-${++n}`;
      await db.insert(posts).values({ title: it.title, slug, excerpt: it.summary, body: null, imageUrl: it.image, category: it.category || (src.scope === "caribbean" ? "Regional news" : "News"), origin: "rss", scope: src.scope === "caribbean" ? "caribbean" : "news", status: "published", publishedAt: it.date && !isNaN(it.date.getTime()) ? it.date : new Date(), sourceUrl: it.link, sourceName: src.name, guid, rssSourceId: src.id });
      imported++;
    }
    await db.update(rssSources).set({ lastSyncedAt: new Date(), lastError: null, itemCount: src.itemCount + imported }).where(eq(rssSources.id, src.id));
    return { imported };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 300);
    await db.update(rssSources).set({ lastSyncedAt: new Date(), lastError: msg }).where(eq(rssSources.id, src.id));
    return { imported: 0, error: msg };
  }
}

export async function syncAllRss() {
  const all = await db.select().from(rssSources).where(eq(rssSources.isActive, true));
  const out: Record<string, { imported: number; error?: string }> = {};
  for (const s of all) out[s.name] = await syncRssSource(s.id);
  return out;
}
