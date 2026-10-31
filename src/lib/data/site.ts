import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, pages, pageBlocks, services, posts, products, testimonials, teamMembers, ccResources, ccEvents, ccCountries, rssSources, socialFeedItems, type Service } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import { getMediaMap, resolveDeep } from "./media";
import { UPCOMING_EVENTS_LOOKBACK_MS, upcomingEvents } from "@/lib/cc-events";

export const getSiteChrome = cache(async () => {
  const [settings, svc] = await Promise.all([
    getSettings(["contact", "footer", "social_links", "consult_form", "social"]),
    db.select({ slug: services.slug, title: services.title, parentId: services.parentId, id: services.id, navGroup: services.navGroup, sort: services.sort, status: services.status }).from(services).orderBy(asc(services.sort)),
  ]);
  const published = svc.filter((s) => s.status === "published");
  const top = published.filter((s) => !s.parentId && s.navGroup === "services");
  const nav = top.map((s) => ({ ...s, href: serviceHref(s.slug), children: published.filter((c) => c.parentId === s.id).map((c) => ({ ...c, href: serviceHref(c.slug, s.slug) })) }));
  return { settings, servicesNav: nav };
});

export function serviceHref(slug: string, parentSlug?: string | null) {
  if (slug === "general") return "/services/start";
  if (slug === "aip-partners") return "/healthy-home-resources/aip-partners";
  if (slug === "virtual-assessment") return "/services/aging-in-place/virtual";
  if (parentSlug) return `/services/${parentSlug}/${slug}`;
  if (slug === "design-refresh" || slug === "model-home") return `/services/residential/${slug}`;
  return `/services/${slug}`;
}

export const getPage = cache(async (key: string, preview = false) => {
  const page = await db.query.pages.findFirst({ where: eq(pages.key, key) });
  if (!page) return null;
  if (page.status !== "published" && !preview) return null;
  const blocks = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, page.id)).orderBy(asc(pageBlocks.sort));
  const map = await getMediaMap();
  const resolved = blocks
    .map((b) => ({ id: b.id, type: b.type, visible: preview ? (b.draftVisible ?? b.visible) : b.visible, content: resolveDeep(map, (preview && b.draftContent) ? b.draftContent : b.content) }))
    .filter((b) => b.visible);
  return { page, blocks: resolved };
});

export const getServiceBySlug = cache(async (slug: string, preview = false) => {
  const row = await db.query.services.findFirst({ where: eq(services.slug, slug) });
  if (!row || (row.status !== "published" && !preview)) return null;
  const map = await getMediaMap();
  const resolved = resolveDeep(map, { img: row.img, img2: row.img2, scenes: row.scenes, beforeAfter: row.beforeAfter });
  const all = await db.select({ id: services.id, slug: services.slug, title: services.title, parentId: services.parentId, navGroup: services.navGroup, status: services.status }).from(services).orderBy(asc(services.sort));
  const parent = row.parentId ? all.find((s) => s.id === row.parentId) : null;
  return { service: { ...row, ...resolved } as Service & typeof resolved, all: all.filter((s) => s.status === "published"), parent };
});

export const getServiceList = cache(async () => {
  const map = await getMediaMap();
  const rows = await db.select().from(services).where(and(eq(services.status, "published"), isNull(services.parentId), eq(services.navGroup, "services"))).orderBy(asc(services.sort));
  const children = await db.select({ slug: services.slug, title: services.title, parentId: services.parentId }).from(services).where(eq(services.status, "published"));
  return rows.map((s) => ({ ...s, img: resolveDeep(map, s.img), children: children.filter((c) => c.parentId === s.id) }));
});

export const getPublishedPosts = cache(async (scope: "news" | "caribbean" = "news", limit = 20) => {
  const map = await getMediaMap();
  const rows = await db.select().from(posts).where(and(eq(posts.status, "published"), eq(posts.scope, scope))).orderBy(desc(posts.featured), desc(posts.publishedAt)).limit(limit);
  return rows.map((p) => ({ ...p, imageUrl: resolveDeep(map, p.imageUrl) }));
});

export const getPost = cache(async (slug: string) => {
  const map = await getMediaMap();
  const p = await db.query.posts.findFirst({ where: and(eq(posts.slug, slug), eq(posts.status, "published")) });
  return p ? { ...p, imageUrl: resolveDeep(map, p.imageUrl) } : null;
});

export const getProducts = cache(async (featuredOnly = false) => {
  const map = await getMediaMap();
  const rows = await db.select().from(products).where(featuredOnly ? and(eq(products.isActive, true), eq(products.featured, true)) : eq(products.isActive, true)).orderBy(asc(products.sort), asc(products.id));
  return rows.map((p) => ({ ...p, imageUrl: resolveDeep(map, p.imageUrl) }));
});

export const getTestimonials = cache(async () => db.select().from(testimonials).where(eq(testimonials.visible, true)).orderBy(asc(testimonials.sort)));
export const getFounder = cache(async () => { const map = await getMediaMap(); const t = await db.query.teamMembers.findFirst({ where: eq(teamMembers.visible, true), orderBy: asc(teamMembers.sort) }); return t ? { ...t, photoUrl: resolveDeep(map, t.photoUrl) } : null; });

export const getCaribbeanData = cache(async () => {
  const liveCountries = await db.select().from(ccCountries).orderBy(asc(ccCountries.sort));
  const liveNames = liveCountries.filter((c) => c.status === "live").map((c) => c.name);
  const countryFilter = (col: any) => or(inArray(col, liveNames.length ? [...liveNames, "Regional", "Diaspora", "Regional / Diaspora"] : ["Jamaica", "Regional", "Diaspora"]), sql`${col} is null`);
  const [resources, events, regional, gidPosts, feeds] = await Promise.all([
    db.select().from(ccResources).where(and(eq(ccResources.status, "published"), countryFilter(ccResources.country))).orderBy(asc(ccResources.sort), asc(ccResources.name)),
    // Published events through the end of their own date (midnight in the event's time zone). The query only narrows; src/lib/cc-events.ts has the rule and its test.
    db.select().from(ccEvents).where(and(eq(ccEvents.status, "published"), gte(ccEvents.startsAt, new Date(Date.now() - UPCOMING_EVENTS_LOOKBACK_MS)))).orderBy(asc(ccEvents.startsAt)).then((rows) => upcomingEvents(rows, new Date(), 8)),
    getPublishedPosts("caribbean", 20).then((rows) => rows.filter((p) => p.origin === "rss").slice(0, 6)),
    getPublishedPosts("caribbean", 20).then((rows) => rows.filter((p) => p.origin !== "rss").slice(0, 3)),
    db.select().from(rssSources).where(and(eq(rssSources.scope, "caribbean"), eq(rssSources.isActive, true))),
  ]);
  return { countries: liveCountries, resources, events, regional, gidPosts, feeds };
});

export const getInstagramFeed = cache(async (limit = 6) => db.select().from(socialFeedItems).where(eq(socialFeedItems.network, "instagram")).orderBy(desc(socialFeedItems.postedAt)).limit(limit));
