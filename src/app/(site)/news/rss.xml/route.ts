import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, posts } from "@/lib/db";
import { env } from "@/lib/env";
import { getMediaMap, resolveDeep } from "@/lib/data/media";
import { mimeFromName } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
// Strip characters XML 1.0 does not allow (stray control bytes pasted into a post would break the whole feed).
// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/**
 * Public RSS 2.0 feed of News & Insights articles, newest first.
 *
 *   /news/rss.xml                     every article we wrote
 *   /news/rss.xml?category=WELLness   one category (comma-separate for several; case-insensitive)
 *
 * Articles imported from other sites' feeds (Admin → RSS) are left out so we never re-publish someone else's content.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cats = (url.searchParams.get("category") || "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 10);
  const base = env.baseUrl.replace(/\/$/, "");
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : `${base}${u.startsWith("/") ? "" : "/"}${u}`);

  const rows = await db.select().from(posts)
    .where(and(eq(posts.status, "published"), eq(posts.scope, "news"), eq(posts.origin, "written"), cats.length ? inArray(sql`lower(${posts.category})`, cats.map((c) => c.toLowerCase())) : undefined))
    .orderBy(desc(posts.publishedAt)).limit(50);
  const map = await getMediaMap();

  const title = cats.length ? `Grace In Design — ${cats.join(", ")} articles` : "Grace In Design — News & Insights";
  const pageLink = cats.length ? `${base}/news?category=${encodeURIComponent(cats.join(","))}` : `${base}/news`;
  const self = `${base}/news/rss.xml${cats.length ? `?category=${encodeURIComponent(cats.join(","))}` : ""}`;

  const items = rows.map((p) => {
    const link = `${base}/news/${p.slug}`;
    const img = p.imageUrl ? resolveDeep(map, p.imageUrl) : "";
    const summary = p.excerpt || text(p.body || "").slice(0, 300);
    const imgUrl = img ? abs(img) : "";
    return [
      "<item>",
      `<title>${esc(clean(p.title))}</title>`,
      `<link>${esc(link)}</link>`,
      `<guid isPermaLink="true">${esc(link)}</guid>`,
      p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : "",
      `<category>${esc(clean(p.category))}</category>`,
      `<description>${esc(clean(summary))}</description>`,
      // RSS.app and most readers pick up the image from either of these.
      imgUrl ? `<enclosure url="${esc(imgUrl)}" type="${esc(mimeFromName(imgUrl.split("?")[0]).startsWith("image/") ? mimeFromName(imgUrl.split("?")[0]) : "image/jpeg")}" length="0" />` : "",
      imgUrl ? `<media:content url="${esc(imgUrl)}" medium="image" />` : "",
      "</item>",
    ].filter(Boolean).join("");
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${esc(title)}</title>
<link>${esc(pageLink)}</link>
<description>${esc(cats.length ? `${cats.join(", ")} articles from Grace In Design: healthier homes, workplaces and spaces.` : "Articles from Grace In Design on healthy, accessible and beautiful spaces.")}</description>
<language>en-us</language>
<atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />
${rows[0]?.publishedAt ? `<lastBuildDate>${rows[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${items.join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
