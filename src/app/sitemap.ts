import type { MetadataRoute } from "next";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { db, pages, posts, services, ccEvents } from "@/lib/db";
import { eventPath } from "@/lib/events";
import { serviceHref } from "@/lib/data/site";

export const dynamic = "force-dynamic";

const CORE_KEYS = new Set(["home", "about", "services", "hhr", "aip-products", "wellness", "home-health", "caribbean", "news", "contact", "privacy", "terms", "accessibility"]);

/** Published CMS pages, service landings, news articles and event pages. Read at request time so admin changes show up without a rebuild. */
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
    out.push({ url: url("/events"), changeFrequency: "weekly", priority: 0.6 });
    const eventRows = await db.select({ slug: ccEvents.slug, updatedAt: ccEvents.updatedAt }).from(ccEvents).where(and(eq(ccEvents.status, "published"), isNotNull(ccEvents.slug))).orderBy(desc(ccEvents.startsAt)).limit(500);
    for (const e of eventRows) out.push({ url: url(eventPath(e.slug!)), lastModified: e.updatedAt, changeFrequency: "weekly", priority: 0.6 });
  } catch (e) {
    console.error("[sitemap] database unavailable, serving the homepage only:", (e as Error).message);
    if (out.length === 0) out.push({ url: url("/"), priority: 1 });
  }
  return out;
}
