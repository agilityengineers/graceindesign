"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, pages, pageBlocks, services, posts, testimonials, teamMembers, paths } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool, slugify, tryJson } from "@/lib/utils";
import { uploadToMedia } from "@/lib/server/media-upload";
import { autoShareBlogPost } from "@/lib/server/social";

const SITE_PATHS = ["/", "/about", "/services", "/healthy-home-resources", "/caribbean-connection", "/news", "/contact"];
const REVAL = ["/admin/content", ...SITE_PATHS];

/** Apply uploaded files named `file::a.b.0.c` into a JSON object at that dotted path. */
async function applyFileFields(formData: FormData, content: Record<string, unknown>, folder: string) {
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("file::") || !(value instanceof File) || value.size === 0) continue;
    const url = (await uploadToMedia(value, { folder, usedOn: [folder] })).url;
    const segs = name.slice(6).split(".");
    let cur: any = content;
    for (let i = 0; i < segs.length - 1; i++) { const k = /^\d+$/.test(segs[i]) ? Number(segs[i]) : segs[i]; if (cur[k] == null || typeof cur[k] !== "object") cur[k] = /^\d+$/.test(segs[i + 1]) ? [] : {}; cur = cur[k]; }
    const last = segs[segs.length - 1]; cur[/^\d+$/.test(last) ? Number(last) : last] = url;
  }
  return content;
}

// --- Pages & blocks ---------------------------------------------------------
export async function savePageSeo(formData: FormData) {
  const id = parseNum(formData.get("pageId"));
  await adminAction("pages", "page", "update", async () => {
    const page = await db.query.pages.findFirst({ where: eq(pages.id, id) }); if (!page) throw new Error("Page not found");
    await db.update(pages).set({ title: str(formData.get("title")) || page.title, navLabel: strOrNull(formData.get("navLabel")) || page.navLabel, seoTitle: strOrNull(formData.get("seoTitle")), seoDescription: strOrNull(formData.get("seoDescription")), slug: page.key === "home" ? "/" : "/" + str(formData.get("slug")).replace(/^\/+/, "") || page.slug, status: str(formData.get("status")) === "draft" ? "draft" : "published", updatedAt: new Date() }).where(eq(pages.id, id));
    return page.key;
  }, { back: backTo(formData, "/admin/content"), ok: "Page settings saved", entityId: (k) => k, revalidate: REVAL });
}
export async function saveBlock(formData: FormData) {
  const id = parseNum(formData.get("blockId")); const back = backTo(formData, "/admin/content");
  await adminAction("pages", "page_block", "draft", async () => {
    const block = await db.query.pageBlocks.findFirst({ where: eq(pageBlocks.id, id) }); if (!block) throw new Error("Block not found");
    const content = tryJson<Record<string, unknown> | null>(str(formData.get("content")), null); if (!content || typeof content !== "object") throw new Error("Could not read the block content");
    await applyFileFields(formData, content, `pages/${block.pageId}/blocks`);
    await db.update(pageBlocks).set({ draftContent: content, updatedAt: new Date() }).where(eq(pageBlocks.id, id));
    await db.update(pages).set({ hasDraft: true, updatedAt: new Date() }).where(eq(pages.id, block.pageId));
    return id;
  }, { back, ok: "Draft saved — preview, then publish", entityId: () => id, revalidate: ["/admin/content"] });
}
export async function blockAction(formData: FormData) {
  const id = parseNum(formData.get("blockId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/content");
  await adminAction("pages", "page_block", op, async () => {
    const block = await db.query.pageBlocks.findFirst({ where: eq(pageBlocks.id, id) }); if (!block) throw new Error("Block not found");
    if (op === "toggle") { const cur = block.draftVisible ?? block.visible; await db.update(pageBlocks).set({ draftVisible: !cur, updatedAt: new Date() }).where(eq(pageBlocks.id, id)); await db.update(pages).set({ hasDraft: true }).where(eq(pages.id, block.pageId)); }
    else if (op === "delete") await db.delete(pageBlocks).where(eq(pageBlocks.id, id));
    else if (op === "discard") await db.update(pageBlocks).set({ draftContent: null, draftVisible: null, updatedAt: new Date() }).where(eq(pageBlocks.id, id));
    else if (op === "duplicate") { const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(pageBlocks).where(eq(pageBlocks.pageId, block.pageId)); await db.insert(pageBlocks).values({ pageId: block.pageId, type: block.type, sort: Number(n), content: block.draftContent || block.content, visible: block.visible }); }
    return id;
  }, { back, ok: op === "delete" ? "Block removed" : op === "discard" ? "Draft discarded" : op === "duplicate" ? "Block duplicated" : "Visibility updated (unpublished)", entityId: () => id, revalidate: REVAL });
}
export async function addBlock(formData: FormData) {
  const pageId = parseNum(formData.get("pageId")); const back = backTo(formData, "/admin/content");
  await adminAction("pages", "page_block", "create", async () => {
    const type = str(formData.get("type")); if (!type) throw new Error("Pick a block type");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(pageBlocks).where(eq(pageBlocks.pageId, pageId));
    const starter: Record<string, Record<string, unknown>> = { rich_text: { title: "New section", body: "<p>Write something…</p>" }, cta: { title: "Ready to get started?", body: "Tell us a little about your project.", cta: "Get Started", ctaHref: "/contact" }, steps: { items: [["Step one", "Describe it"], ["Step two", "Describe it"], ["Step three", "Describe it"]] }, page_header: { eyebrow: "Section", title: "Headline", sub: "Supporting copy." }, news: { eyebrow: "News & Insights", title: "Latest articles", linkLabel: "All articles", linkHref: "/news", count: 3 }, featured_products: { eyebrow: "Featured", title: "Products", linkLabel: "Browse", linkHref: "/healthy-home-resources/aip-products", count: 4 }, product_grid: { title: "All products", shelf: "aip", categories: [], disclosure: "" }, product_shelf: { eyebrow: "Shop our picks", title: "Tools we recommend", body: "", shelf: "", categories: [], featuredOnly: false, limit: 4, linkLabel: "See all products", linkHref: "/healthy-home-resources/aip-products", cartAll: true, cartAllLabel: "Add all to your Amazon cart", disclosure: "" }, consult_form: { title: "Start your project" } };
    const [b] = await db.insert(pageBlocks).values({ pageId, type, sort: Number(n), content: starter[type] || {}, visible: true }).returning();
    return b;
  }, { back, ok: "Block added", entityId: (b) => b.id, revalidate: REVAL });
}
export async function reorderBlocks(pageId: number, ids: number[]) {
  const user = await requireArea("pages");
  for (const [i, id] of ids.entries()) await db.update(pageBlocks).set({ sort: i }).where(and(eq(pageBlocks.id, id), eq(pageBlocks.pageId, pageId)));
  await audit(user.id, "reorder", "page_block", pageId, { ids });
  for (const p of REVAL) revalidatePath(p, "layout"); return { ok: true };
}
export async function publishPage(formData: FormData) {
  const id = parseNum(formData.get("pageId")); const back = backTo(formData, "/admin/content");
  await adminAction("pages", "page", "publish", async () => {
    const blocks = await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, id));
    for (const b of blocks) if (b.draftContent || b.draftVisible != null) await db.update(pageBlocks).set({ content: b.draftContent || b.content, visible: b.draftVisible ?? b.visible, draftContent: null, draftVisible: null, updatedAt: new Date() }).where(eq(pageBlocks.id, b.id));
    await db.update(pages).set({ hasDraft: false, status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(pages.id, id));
    return id;
  }, { back, ok: "Page published", entityId: () => id, revalidate: REVAL });
}
export async function discardPageDraft(formData: FormData) {
  const id = parseNum(formData.get("pageId")); const back = backTo(formData, "/admin/content");
  await adminAction("pages", "page", "discard_draft", async () => { await db.update(pageBlocks).set({ draftContent: null, draftVisible: null }).where(eq(pageBlocks.pageId, id)); await db.update(pages).set({ hasDraft: false }).where(eq(pages.id, id)); return id; }, { back, ok: "Draft discarded", entityId: () => id, revalidate: ["/admin/content"] });
}
export async function createPage(formData: FormData) {
  await adminAction("pages", "page", "create", async () => {
    const title = str(formData.get("title")); if (!title) throw new Error("Title is required");
    const key = slugify(str(formData.get("key")) || title); if (!key) throw new Error("Key is required");
    if (await db.query.pages.findFirst({ where: eq(pages.key, key) })) throw new Error("A page with that key already exists");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(pages);
    const [p] = await db.insert(pages).values({ key, slug: `/${slugify(str(formData.get("slug")) || key)}`, title, navLabel: title, heroStyle: "classic", status: "draft", sort: Number(n) + 100 }).returning();
    await db.insert(pageBlocks).values([{ pageId: p.id, type: "page_header", sort: 0, content: { eyebrow: "Grace In Design", title, sub: "" } }, { pageId: p.id, type: "rich_text", sort: 1, content: { title: "", body: "<p>Write something…</p>" } }]);
    return p;
  }, { back: "/admin/content", ok: "Page created (draft) — it renders at /p/<key> once published", entityId: (p) => p.id, revalidate: REVAL });
}
export async function deletePage(formData: FormData) {
  const id = parseNum(formData.get("pageId"));
  await adminAction("pages", "page", "delete", async () => { const p = await db.query.pages.findFirst({ where: eq(pages.id, id) }); if (!p) throw new Error("Page not found"); if (["home", "about", "services", "hhr", "caribbean", "news", "contact"].includes(p.key)) throw new Error("Core pages can be unpublished but not deleted"); await db.delete(pages).where(eq(pages.id, id)); return id; }, { back: "/admin/content", ok: "Page deleted", entityId: () => id, revalidate: REVAL });
}

// --- Services ----------------------------------------------------------------
const tuple2 = (v: FormDataEntryValue | null) => str(v).split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0]).map((r) => [r[0], r[1] || ""] as [string, string]);
const tuple3 = (v: FormDataEntryValue | null) => str(v).split(/\r?\n/).map((l) => l.split("|").map((x) => x.trim())).filter((r) => r[0]).map((r) => [r[0], r[1] || "", r[2] || ""] as [string, string, string]);
const lines = (v: FormDataEntryValue | null) => str(v).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export async function saveService(formData: FormData) {
  const id = formData.get("serviceId") ? parseNum(formData.get("serviceId")) : null;
  await adminAction("services", "service", id ? "update" : "create", async (user) => {
    const title = str(formData.get("title")); if (!title) throw new Error("Title is required");
    const slug = slugify(str(formData.get("slug")) || title); if (!slug) throw new Error("Slug is required");
    const dupe = await db.query.services.findFirst({ where: eq(services.slug, slug) }); if (dupe && dupe.id !== id) throw new Error("That slug is already used");
    const parentId = formData.get("parentId") ? parseNum(formData.get("parentId")) : null;
    const pathId = strOrNull(formData.get("pathId")); if (pathId && !(await db.query.paths.findFirst({ where: eq(paths.id, pathId) }))) throw new Error("Unknown form path");
    let img = str(formData.get("img")); let img2 = str(formData.get("img2"));
    const f1 = formData.get("img_file"); const f2 = formData.get("img2_file");
    if (f1 instanceof File && f1.size > 0) img = (await uploadToMedia(f1, { folder: `services/${slug}`, usedOn: [`service:${slug}`], userId: user.id })).url;
    if (f2 instanceof File && f2.size > 0) img2 = (await uploadToMedia(f2, { folder: `services/${slug}`, usedOn: [`service:${slug}`], userId: user.id })).url;
    const tiers = tuple3(formData.get("tiers"));
    const values = { slug, title, kicker: str(formData.get("kicker")) || title, parentId: parentId === id ? null : parentId, navGroup: ["services", "hhr", "hidden"].includes(str(formData.get("navGroup"))) ? str(formData.get("navGroup")) : "services", hero: str(formData.get("hero")) || title, sub: str(formData.get("sub")), problem: str(formData.get("problem")), empathy: str(formData.get("empathy")), authority: str(formData.get("authority")), plan: tuple2(formData.get("plan")), success: lines(formData.get("success")), failure: str(formData.get("failure")), features: tuple2(formData.get("features")), tiers: tiers.length ? tiers : null, tiersTitle: strOrNull(formData.get("tiersTitle")), tiersSub: strOrNull(formData.get("tiersSub")), steps: lines(formData.get("steps")).length ? lines(formData.get("steps")) : null, testimonialQuote: strOrNull(formData.get("testimonialQuote")), testimonialWho: strOrNull(formData.get("testimonialWho")), img: img || "/api/placeholder?label=service", img2: img2 || img || "/api/placeholder?label=service", cta: str(formData.get("cta")) || "Start a Project", pathId, status: (str(formData.get("status")) === "draft" ? "draft" : "published") as "draft" | "published", seoTitle: strOrNull(formData.get("seoTitle")), seoDescription: strOrNull(formData.get("seoDescription")), updatedAt: new Date() };
    if (id) { await db.update(services).set(values).where(eq(services.id, id)); return id; }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(services);
    const [s] = await db.insert(services).values({ ...values, sort: Number(n), cineLead: "Design for", cineTail: "— today and for years to come.", scenes: [], heroStyle: "classic" }).returning();
    return s.id;
  }, { back: id ? `/admin/content/services/${id}` : "/admin/content/services", ok: id ? "Service saved" : "Service created", entityId: (k) => k, revalidate: [...REVAL, "/admin/content/services"] });
}
export async function serviceAction(formData: FormData) {
  const id = parseNum(formData.get("serviceId")); const op = str(formData.get("op"));
  await adminAction("services", "service", op, async () => {
    if (op === "delete") { await db.update(services).set({ parentId: null }).where(eq(services.parentId, id)); await db.delete(services).where(eq(services.id, id)); }
    else if (op === "publish" || op === "unpublish") await db.update(services).set({ status: op === "publish" ? "published" : "draft", updatedAt: new Date() }).where(eq(services.id, id));
    return id;
  }, { back: "/admin/content/services", ok: op === "delete" ? "Service deleted" : op === "publish" ? "Service published" : "Service unpublished", entityId: () => id, revalidate: [...REVAL, "/admin/content/services"] });
}
export async function reorderServices(ids: number[]) {
  const user = await requireArea("services");
  for (const [i, id] of ids.entries()) await db.update(services).set({ sort: i }).where(eq(services.id, id));
  await audit(user.id, "reorder", "service", null, { ids });
  for (const p of REVAL) revalidatePath(p, "layout"); return { ok: true };
}

// --- Posts -------------------------------------------------------------------
export async function savePost(formData: FormData) {
  const id = formData.get("postId") ? parseNum(formData.get("postId")) : null;
  const wanted = str(formData.get("intent")); // save | publish
  let newId = id;
  await adminAction("posts", "post", id ? "update" : "create", async (user) => {
    const title = str(formData.get("title")); if (!title) throw new Error("Title is required");
    let slug = slugify(str(formData.get("slug")) || title) || `post-${Date.now()}`;
    const dupe = await db.query.posts.findFirst({ where: eq(posts.slug, slug) }); if (dupe && dupe.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    let imageUrl = strOrNull(formData.get("imageUrl")); const f = formData.get("image_file");
    if (f instanceof File && f.size > 0) imageUrl = (await uploadToMedia(f, { folder: `posts/${slug}`, usedOn: [`post:${slug}`], userId: user.id })).url;
    const status = wanted === "publish" ? "published" : (str(formData.get("status")) === "published" ? "published" : "draft");
    const values = { title, slug, excerpt: strOrNull(formData.get("excerpt")), body: strOrNull(formData.get("body")), imageUrl, category: str(formData.get("category")) || "Healthy Home Resources", scope: (str(formData.get("scope")) === "caribbean" ? "caribbean" : "news") as "news" | "caribbean", featured: bool(formData.get("featured")), status: status as "draft" | "published", updatedAt: new Date() };
    let row;
    if (id) { const prev = await db.query.posts.findFirst({ where: eq(posts.id, id) }); [row] = await db.update(posts).set({ ...values, publishedAt: status === "published" ? prev?.publishedAt || new Date() : prev?.publishedAt }).where(eq(posts.id, id)).returning(); }
    else { [row] = await db.insert(posts).values({ ...values, origin: "written", authorId: user.id, publishedAt: status === "published" ? new Date() : null }).returning(); }
    newId = row.id;
    if (status === "published" && !row.autoShared && wanted === "publish") await autoShareBlogPost(row.id, user.id).catch(() => {});
    return row.id;
  }, { back: `/admin/content/posts/${newId ?? "new"}`, ok: wanted === "publish" ? "Post published" : "Post saved", entityId: (k) => k, revalidate: [...REVAL, "/admin/content/posts", "/news"] });
}
export async function postAction(formData: FormData) {
  const id = parseNum(formData.get("postId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/content/posts");
  await adminAction("posts", "post", op, async (user) => {
    const p = await db.query.posts.findFirst({ where: eq(posts.id, id) }); if (!p) throw new Error("Post not found");
    if (op === "delete") await db.delete(posts).where(eq(posts.id, id));
    else if (op === "publish") { await db.update(posts).set({ status: "published", publishedAt: p.publishedAt || new Date(), updatedAt: new Date() }).where(eq(posts.id, id)); if (!p.autoShared) await autoShareBlogPost(id, user.id).catch(() => {}); }
    else if (op === "unpublish") await db.update(posts).set({ status: "draft", updatedAt: new Date() }).where(eq(posts.id, id));
    else if (op === "feature") await db.update(posts).set({ featured: !p.featured, updatedAt: new Date() }).where(eq(posts.id, id));
    else if (op === "share") await autoShareBlogPost(id, user.id);
    return id;
  }, { back, ok: { delete: "Post deleted", publish: "Post published", unpublish: "Post unpublished", feature: "Featured flag updated", share: "Queued for social sharing" }[op] || "Done", entityId: () => id, revalidate: [...REVAL, "/admin/content/posts", "/news", "/admin/social"] });
}

// --- Testimonials ------------------------------------------------------------
export async function saveTestimonial(formData: FormData) {
  const id = formData.get("testimonialId") ? parseNum(formData.get("testimonialId")) : null;
  await adminAction("pages", "testimonial", id ? "update" : "create", async () => {
    const quote = str(formData.get("quote")); if (!quote) throw new Error("Quote is required");
    const values = { quote, who: str(formData.get("who")) || "Client", whereLabel: str(formData.get("whereLabel")) || "Atlanta, GA", serviceSlug: strOrNull(formData.get("serviceSlug")), visible: formData.has("visible") ? bool(formData.get("visible")) : true, updatedAt: new Date() };
    if (id) { await db.update(testimonials).set(values).where(eq(testimonials.id, id)); return id; }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(testimonials);
    const [t] = await db.insert(testimonials).values({ ...values, sort: Number(n) }).returning(); return t.id;
  }, { back: "/admin/content/testimonials", ok: "Testimonial saved", entityId: (k) => k, revalidate: [...REVAL, "/admin/content/testimonials"] });
}
export async function testimonialAction(formData: FormData) {
  const id = parseNum(formData.get("testimonialId")); const op = str(formData.get("op"));
  await adminAction("pages", "testimonial", op, async () => { if (op === "delete") await db.delete(testimonials).where(eq(testimonials.id, id)); else if (op === "toggle") await db.update(testimonials).set({ visible: sql`not ${testimonials.visible}` }).where(eq(testimonials.id, id)); return id; }, { back: "/admin/content/testimonials", ok: op === "delete" ? "Testimonial deleted" : "Visibility updated", entityId: () => id, revalidate: [...REVAL, "/admin/content/testimonials"] });
}
export async function reorderTestimonials(ids: number[]) {
  const user = await requireArea("pages");
  for (const [i, id] of ids.entries()) await db.update(testimonials).set({ sort: i }).where(eq(testimonials.id, id));
  await audit(user.id, "reorder", "testimonial", null, { ids });
  for (const p of REVAL) revalidatePath(p, "layout"); return { ok: true };
}

// --- Team --------------------------------------------------------------------
export async function saveTeamMember(formData: FormData) {
  const id = formData.get("memberId") ? parseNum(formData.get("memberId")) : null;
  await adminAction("pages", "team_member", id ? "update" : "create", async (user) => {
    const name = str(formData.get("name")); if (!name) throw new Error("Name is required");
    let photoUrl = strOrNull(formData.get("photoUrl")); const f = formData.get("photo_file");
    if (f instanceof File && f.size > 0) photoUrl = (await uploadToMedia(f, { folder: "team", usedOn: ["About", "Home"], userId: user.id })).url;
    const values = { name, title: str(formData.get("title")) || "Team member", credentials: strOrNull(formData.get("credentials")), quote: strOrNull(formData.get("quote")), bio: strOrNull(formData.get("bio")), bio2: strOrNull(formData.get("bio2")), education: lines(formData.get("education")), credentialList: lines(formData.get("credentialList")), photoUrl, visible: formData.has("visible") ? bool(formData.get("visible")) : true, updatedAt: new Date() };
    if (id) { await db.update(teamMembers).set(values).where(eq(teamMembers.id, id)); return id; }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(teamMembers);
    const [t] = await db.insert(teamMembers).values({ ...values, sort: Number(n) }).returning(); return t.id;
  }, { back: "/admin/content/team", ok: "Saved", entityId: (k) => k, revalidate: [...REVAL, "/admin/content/team"] });
}
export async function deleteTeamMember(formData: FormData) {
  const id = parseNum(formData.get("memberId"));
  await adminAction("pages", "team_member", "delete", async () => { const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(teamMembers); if (Number(n) <= 1) throw new Error("Keep at least one team member — the About page needs a founder"); await db.delete(teamMembers).where(eq(teamMembers.id, id)); return id; }, { back: "/admin/content/team", ok: "Team member removed", entityId: () => id, revalidate: [...REVAL, "/admin/content/team"] });
}
