import type { MetadataRoute } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { db, pages, posts, services } from "@/lib/db";
import { serviceHref } from "@/lib/data/site";

export const dynamic = "force-dynamic";

const CORE_KEYS = new Set(["home", "about", "services", "hhr", "aip-products", "wellness", "home-health", "caribbean", "news", "contact", "privacy", "terms", "accessibility"]);

/** Published CMS pages, service landings and news articles. Read at request time so admin changes show up without a rebuild. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
  const url = (p: string) => `${base}${p}`;
  const out: MetadataRoute.Sitemap = [];
  try {
    const pageRows = await db.select({ key: pages.key, slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.status, "published")).orderBy(asc(pages.sort));
    for (const p of pageRows) {
      const path = CORE_KEYS.has(p.key) ? p.slug : `/p/${p.key}`;
      out.push({ url: url(path), lastModified: p.updatedAt, changeFrequency: p.key === "home" ? "weekly" : "monthly", priority: p.key === "home" ? 1 : 0.7 });
    }
    const svc = await db.select({ id: services.id, slug: services.slug, parentId: services.parentId, updatedAt: services.updatedAt }).from(services).where(eq(services.status, "published")).orderBy(asc(services.sort));
    for (const s of svc) {
      if (s.slug === "general") continue;
      const parent = s.parentId ? svc.find((x) => x.id === s.parentId) : null;
      out.push({ url: url(serviceHref(s.slug, parent?.slug)), lastModified: s.updatedAt, changeFrequency: "monthly", priority: 0.8 });
    }
    const postRows = await db.select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt }).from(posts).where(eq(posts.status, "published")).orderBy(desc(posts.publishedAt)).limit(500);
    for (const p of postRows) out.push({ url: url(`/news/${p.slug}`), lastModified: p.updatedAt || p.publishedAt || undefined, changeFrequency: "yearly", priority: 0.5 });
  } catch (e) {
    console.error("[sitemap] database unavailable, serving the homepage only:", (e as Error).message);
    if (out.length === 0) out.push({ url: url("/"), priority: 1 });
  }
  return out;
}
