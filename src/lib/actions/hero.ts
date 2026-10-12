"use server";
import { and, eq, inArray } from "drizzle-orm";
import { db, pages, pageBlocks, services } from "@/lib/db";
import { adminAction } from "./_util";
import { str, strOrNull, parseNum, bool } from "@/lib/utils";
import { uploadToMedia } from "@/lib/server/media-upload";

type Scene = { name: string; word: string; line: string; img: string; href?: string };

async function loadHero(kind: string, id: string) {
  if (kind === "service") { const s = await db.query.services.findFirst({ where: eq(services.slug, id) }); if (!s) throw new Error("Service not found"); return { service: s }; }
  const page = await db.query.pages.findFirst({ where: eq(pages.key, id) }); if (!page) throw new Error("Page not found");
  const block = await db.query.pageBlocks.findFirst({ where: and(eq(pageBlocks.pageId, page.id), inArray(pageBlocks.type, ["hero", "cine_hero", "about_hero"])) }); if (!block) throw new Error("This page has no hero block");
  return { page, block };
}
const revalidateFor = (kind: string, id: string) => ["/admin/hero", "/", kind === "service" ? "/services" : `/${id === "home" ? "" : id}`];

/** Saves the whole hero editor form: style, headline, CTA, seconds, every scene (with optional photo uploads), before/after. */
export async function saveHero(formData: FormData) {
  const kind = str(formData.get("kind")) === "service" ? "service" : "page"; const id = str(formData.get("id"));
  await adminAction("hero", kind === "service" ? "service" : "page", "hero_update", async (user) => {
    const target = await loadHero(kind, id);
    const style = str(formData.get("heroStyle")) === "classic" ? "classic" : "cinematic";
    const count = parseNum(formData.get("sceneCount"));
    const scenes: Scene[] = [];
    for (let i = 0; i < count; i++) {
      if (formData.get(`scene_${i}_delete`) === "1") continue;
      let img = str(formData.get(`scene_${i}_img`));
      const file = formData.get(`scene_${i}_file`);
      if (file instanceof File && file.size > 0) img = (await uploadToMedia(file, { folder: `hero/${kind}/${id}`, usedOn: [`${kind}:${id} hero`], userId: user.id })).url;
      scenes.push({ name: str(formData.get(`scene_${i}_name`)) || `Scene ${i + 1}`, word: str(formData.get(`scene_${i}_word`)), line: str(formData.get(`scene_${i}_line`)), img: img || "/api/placeholder?label=scene", href: strOrNull(formData.get(`scene_${i}_href`)) || undefined });
    }
    const order = str(formData.get("sceneOrder")).split(",").map((n) => Number(n)).filter((n) => !isNaN(n));
    const ordered = order.length === scenes.length && order.every((n) => n >= 0 && n < scenes.length) ? order.map((n) => scenes[n]) : scenes;
    const slideSeconds = Math.max(2, Math.min(20, parseNum(formData.get("slideSeconds"), 5)));
    if ("service" in target && target.service) {
      const s = target.service;
      let beforeAfter = s.beforeAfter;
      const bf = formData.get("before_file"); const af = formData.get("after_file");
      const beforeUrl = bf instanceof File && bf.size > 0 ? (await uploadToMedia(bf, { folder: `hero/service/${id}`, usedOn: [`service:${id} before/after`] })).url : str(formData.get("before_img"));
      const afterUrl = af instanceof File && af.size > 0 ? (await uploadToMedia(af, { folder: `hero/service/${id}`, usedOn: [`service:${id} before/after`] })).url : str(formData.get("after_img"));
      if (bool(formData.get("ba_remove"))) beforeAfter = null;
      else if (beforeUrl || afterUrl) beforeAfter = { before: beforeUrl || s.beforeAfter?.before || "", after: afterUrl || s.beforeAfter?.after || "", title: str(formData.get("ba_title")) || s.beforeAfter?.title || "Before / after" };
      await db.update(services).set({ heroStyle: style, cineLead: strOrNull(formData.get("lead")), cineTail: strOrNull(formData.get("tail")), hero: str(formData.get("classicTitle")) || s.hero, sub: str(formData.get("classicSub")) || s.sub, cta: str(formData.get("cta")) || s.cta, scenesLabel: strOrNull(formData.get("scenesLabel")), slideSeconds, scenes: ordered, beforeAfter, updatedAt: new Date() }).where(eq(services.id, s.id));
      return s.slug;
    }
    if (!("page" in target)) throw new Error("Hero not found");
    const { page, block } = target;
    const c = { ...(block.content as Record<string, unknown>) };
    if (block.type === "about_hero") { c.title = str(formData.get("classicTitle")) || c.title; c.body = str(formData.get("classicSub")) || c.body; c.eyebrow = str(formData.get("kicker")) || c.eyebrow; const f = formData.get("classic_file"); if (f instanceof File && f.size > 0) c.img = (await uploadToMedia(f, { folder: `hero/page/${id}`, usedOn: [`page:${id} hero`] })).url; }
    else {
      c.kicker = str(formData.get("kicker")) || c.kicker; c.lead = str(formData.get("lead")); c.tail = str(formData.get("tail")); c.cta = str(formData.get("cta")) || c.cta; c.scenesLabel = str(formData.get("scenesLabel")) || c.scenesLabel; c.slideSeconds = slideSeconds; c.scenes = ordered;
      if (formData.has("secondary")) c.secondary = strOrNull(formData.get("secondary")) || undefined;
      if (formData.has("sub")) c.sub = strOrNull(formData.get("sub")) || undefined;
      if (block.type === "hero") { const cl = { ...((c.classic as Record<string, unknown>) || {}) }; cl.title = str(formData.get("classicTitle")) || cl.title; cl.sub = str(formData.get("classicSub")) || cl.sub; const f = formData.get("classic_file"); if (f instanceof File && f.size > 0) cl.img = (await uploadToMedia(f, { folder: `hero/page/${id}`, usedOn: [`page:${id} classic hero`] })).url; c.classic = cl; }
    }
    await db.update(pageBlocks).set({ content: c, draftContent: block.draftContent ? { ...(block.draftContent as Record<string, unknown>), ...c } : null, updatedAt: new Date() }).where(eq(pageBlocks.id, block.id));
    await db.update(pages).set({ heroStyle: style, updatedAt: new Date() }).where(eq(pages.id, page.id));
    return page.key;
  }, { back: `/admin/hero?page=${encodeURIComponent(id)}`, ok: "Hero published", entityId: (k) => k, revalidate: revalidateFor(kind, id) });
}
