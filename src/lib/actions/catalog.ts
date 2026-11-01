"use server";
/** Products (Amazon, Etsy, other stores), RSS feeds and Caribbean Connection moderation. */
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, products, rssSources, posts, ccResources, ccEvents, ccCountries, ccSubscribers, newsletterSubscribers, outbox } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool } from "@/lib/utils";
import { fetchListing, syncProducts, refreshedFields, retailerFor, retailerLabel, isListingUrl, asRetailer, defaultType, asinFromUrl } from "@/lib/server/listings";
import { getAmazonItems } from "@/lib/server/amazon";
import { importProducts } from "@/lib/server/product-import";
import { syncRssSource, syncAllRss } from "@/lib/server/rss";
import { getSetting, setSetting } from "@/lib/server/settings";
import { sendEmail } from "@/lib/server/outbox";
import { emitEvent } from "@/lib/server/webhooks";
import { uploadToMedia } from "@/lib/server/media-upload";
import { env } from "@/lib/env";

// --- Products (links to Amazon, Etsy or any other store) ------------------------
const PREVAL = ["/admin/products", "/", "/healthy-home-resources/aip-products", "/healthy-home-resources"];
export async function addProduct(formData: FormData) {
  await adminAction("products", "product", "create", async () => {
    const url = str(formData.get("url")); if (!isListingUrl(url)) throw new Error("Paste the full product link (an Amazon or Etsy listing URL)");
    if (await db.query.products.findFirst({ where: eq(products.url, url) })) throw new Error("That listing is already in the catalog");
    const retailer = retailerFor(url);
    const d = await fetchListing(url);
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(products);
    const [p] = await db.insert(products).values({ url, retailer, title: str(formData.get("title")) || d?.title || `New ${retailerLabel(retailer)} listing (edit title)`, description: strOrNull(formData.get("description")) ?? d?.description ?? null, price: d?.price || "$—", imageUrl: d?.image || null, reviews: d?.reviews || "(0)", type: defaultType(retailer), category: str(formData.get("category")) || "Uncategorized", featured: bool(formData.get("featured")), sort: Number(n), lastSyncedAt: d ? new Date() : null }).returning();
    return p;
  }, { back: "/admin/products", ok: "Listing added — check the title, photo and price on its card", entityId: (p) => p.id, revalidate: PREVAL });
}
/** Add a product picked from the Amazon search in the admin (Product Advertising API). */
export async function addAmazonItem(formData: FormData) {
  await adminAction("products", "product", "create", async () => {
    const asin = str(formData.get("asin")).toUpperCase(); if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error("Pick a product from the search results");
    const existing = (await db.select({ id: products.id, url: products.url }).from(products)).find((p) => asinFromUrl(p.url) === asin);
    if (existing) throw new Error("That product is already in the catalog");
    const [it] = await getAmazonItems([asin]); if (!it) throw new Error("Amazon didn't return that product — try again in a moment");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(products);
    const [p] = await db.insert(products).values({ url: it.url, retailer: "amazon", title: it.title, description: it.description, price: it.price, imageUrl: it.image, reviews: it.reviews, rating: it.rating || "—", type: "", category: str(formData.get("category")) || "Uncategorized", featured: bool(formData.get("featured")), sort: Number(n), lastSyncedAt: new Date() }).returning();
    return p;
  }, { back: "/admin/products", ok: "Product added from Amazon", entityId: (p) => p.id, revalidate: PREVAL });
}
export async function productAction(formData: FormData) {
  const id = parseNum(formData.get("productId")); const op = str(formData.get("op"));
  await adminAction("products", "product", op, async (user) => {
    const p = await db.query.products.findFirst({ where: eq(products.id, id) }); if (!p) throw new Error("Product not found");
    if (op === "delete") await db.delete(products).where(eq(products.id, id));
    else if (op === "feature") await db.update(products).set({ featured: !p.featured, updatedAt: new Date() }).where(eq(products.id, id));
    else if (op === "active") await db.update(products).set({ isActive: !p.isActive, updatedAt: new Date() }).where(eq(products.id, id));
    else if (op === "refresh") { const d = await fetchListing(p.url); if (!d) throw new Error(`${retailerLabel(p.retailer)} didn't return listing details — try again later, or fill the card in by hand`); await db.update(products).set({ ...refreshedFields(p, d), updatedAt: new Date() }).where(eq(products.id, id)); }
    else if (op === "update") {
      let imageUrl = strOrNull(formData.get("imageUrl")) ?? p.imageUrl; const f = formData.get("image_file"); if (f instanceof File && f.size > 0) imageUrl = (await uploadToMedia(f, { folder: "products", usedOn: ["AIP Products"], userId: user.id })).url;
      const url = str(formData.get("url")); const nextUrl = url && isListingUrl(url) ? url : p.url;
      const retailer = nextUrl !== p.url ? retailerFor(nextUrl) : asRetailer(str(formData.get("retailer")) || p.retailer);
      await db.update(products).set({ url: nextUrl, retailer, title: str(formData.get("title")) || p.title, description: strOrNull(formData.get("description")), price: str(formData.get("price")) || p.price, category: str(formData.get("category")) || p.category, tag: strOrNull(formData.get("tag")), type: str(formData.get("type")), rating: str(formData.get("rating")) || p.rating, reviews: str(formData.get("reviews")) || p.reviews, imageUrl, updatedAt: new Date() }).where(eq(products.id, id));
    }
    return id;
  }, { back: "/admin/products", ok: { delete: "Listing removed", feature: "Featured updated", active: "Visibility updated", refresh: "Refreshed from the store page", update: "Product saved" }[op] || "Done", entityId: () => id, revalidate: PREVAL });
}
/** One click in Admin → Products: add the seeded product list (previous site's recommended products) to this database. */
export async function importSeedProducts() {
  await adminAction("products", "product", "import_seed", async () => (await importProducts({ images: true })).added, { back: "/admin/products", ok: "Previous site's products imported — press “Refresh prices & photos” to pull their photos from Amazon", entityId: (n) => n, revalidate: PREVAL });
}
export async function syncProductsNow() {
  await adminAction("products", "product", "sync", async () => syncProducts(), { back: "/admin/products", ok: "Prices, ratings and photos refreshed", revalidate: PREVAL });
}
export async function reorderProducts(ids: number[]) {
  const user = await requireArea("products");
  for (const [i, id] of ids.entries()) await db.update(products).set({ sort: i }).where(eq(products.id, id));
  await audit(user.id, "reorder", "product", null, { ids });
  for (const p of PREVAL) revalidatePath(p, "layout"); return { ok: true };
}

// --- RSS -----------------------------------------------------------------------
const RREVAL = ["/admin/rss", "/admin/caribbean", "/news", "/", "/caribbean-connection"];
export async function addRssSource(formData: FormData) {
  const scope = str(formData.get("scope")) === "caribbean" ? "caribbean" : "news";
  await adminAction("rss", "rss_source", "create", async () => {
    const url = str(formData.get("url")); if (!/^https?:\/\//.test(url)) throw new Error("Enter a feed URL");
    const [s] = await db.insert(rssSources).values({ name: str(formData.get("name")) || new URL(url).hostname, url, scope, country: strOrNull(formData.get("country")) }).returning();
    const r = await syncRssSource(s.id); if (r.error) throw new Error(`Added, but the first sync failed: ${r.error}`);
    return s;
  }, { back: scope === "caribbean" ? "/admin/caribbean?tab=sources" : "/admin/rss", ok: "Feed added and synced", entityId: (s) => s.id, revalidate: RREVAL });
}
export async function rssSourceAction(formData: FormData) {
  const id = parseNum(formData.get("sourceId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/rss");
  await adminAction("rss", "rss_source", op, async () => {
    if (op === "delete") { await db.update(posts).set({ rssSourceId: null }).where(eq(posts.rssSourceId, id)); await db.delete(rssSources).where(eq(rssSources.id, id)); }
    else if (op === "toggle") await db.update(rssSources).set({ isActive: sql`not ${rssSources.isActive}` }).where(eq(rssSources.id, id));
    else if (op === "sync") { const r = await syncRssSource(id); if (r.error) throw new Error(r.error); }
    else if (op === "update") await db.update(rssSources).set({ name: str(formData.get("name")) || undefined, url: str(formData.get("url")) || undefined, country: strOrNull(formData.get("country")) }).where(eq(rssSources.id, id));
    return id;
  }, { back, ok: op === "delete" ? "Feed removed" : op === "sync" ? "Feed synced" : "Feed updated", entityId: () => id, revalidate: RREVAL });
}
export async function syncAllRssNow(formData: FormData) {
  await adminAction("rss", "rss_source", "sync_all", async () => syncAllRss(), { back: backTo(formData, "/admin/rss"), ok: "All feeds synced", revalidate: RREVAL });
}
export async function saveRssSettings(formData: FormData) {
  await adminAction("rss", "setting", "update", async () => { const s = await getSetting("rss"); await setSetting("rss", { ...s, refreshHours: parseNum(formData.get("refreshHours"), 1) || 1, homepageItems: parseNum(formData.get("homepageItems"), 3) || 3, useFeedImage: bool(formData.get("useFeedImage")), fallbackImage: bool(formData.get("fallbackImage")) }); return "rss"; }, { back: "/admin/rss", ok: "Display settings saved", entityId: (k) => k, revalidate: RREVAL });
}

// --- Caribbean Connection ------------------------------------------------------
const CREVAL = ["/admin/caribbean", "/caribbean-connection"];
const cback = (formData: FormData, tab: string) => backTo(formData, `/admin/caribbean?tab=${tab}`);

export async function resourceAction(formData: FormData) {
  const id = parseNum(formData.get("resourceId")); const op = str(formData.get("op")); const back = cback(formData, "resources");
  await adminAction("caribbean", "cc_resource", op, async (user) => {
    const r = await db.query.ccResources.findFirst({ where: eq(ccResources.id, id) }); if (!r) throw new Error("Resource not found");
    const note = strOrNull(formData.get("note"));
    if (op === "approve" || op === "restore") {
      await db.update(ccResources).set({ status: "published", publishedAt: r.publishedAt || new Date(), reviewedBy: user.id, reviewNote: note, updatedAt: new Date() }).where(eq(ccResources.id, id));
      if (op === "approve" && r.submittedByEmail) await sendEmail({ to: r.submittedByEmail, from: "support", subject: `You're listed: ${r.name} is now in the Caribbean Connection directory`, text: `Good news — “${r.name}” has been published in the Caribbean Connection resource directory.\n\n${env.baseUrl}/caribbean-connection#directory\n\nThank you for helping families across the region.\nGrace In Design` });
      if (op === "approve") await emitEvent("cc.submission.published", { type: "resource", id, name: r.name });
    } else if (op === "reject") {
      await db.update(ccResources).set({ status: "rejected", reviewedBy: user.id, reviewNote: note, updatedAt: new Date() }).where(eq(ccResources.id, id));
      if (r.submittedByEmail) await sendEmail({ to: r.submittedByEmail, from: "support", subject: `About your Caribbean Connection submission: ${r.name}`, text: `Thank you for suggesting “${r.name}”. We weren't able to list it this time.${note ? `\n\nReason: ${note}` : ""}\n\nYou're welcome to resubmit with more detail: ${env.baseUrl}/caribbean-connection#directory\n\nGrace In Design` });
    } else if (op === "unpublish") await db.update(ccResources).set({ status: "pending", reviewedBy: user.id, reviewNote: note, updatedAt: new Date() }).where(eq(ccResources.id, id));
    else if (op === "delete") await db.delete(ccResources).where(eq(ccResources.id, id));
    else if (op === "update") await db.update(ccResources).set({ name: str(formData.get("name")) || r.name, category: str(formData.get("category")) || r.category, country: str(formData.get("country")) || r.country, area: strOrNull(formData.get("area")), type: strOrNull(formData.get("type")), url: strOrNull(formData.get("url")), description: str(formData.get("description")) || r.description, kind: str(formData.get("kind")) || r.kind, updatedAt: new Date() }).where(eq(ccResources.id, id));
    return id;
  }, { back, ok: { approve: "Published — submitter emailed", reject: "Rejected — submitter emailed", unpublish: "Unpublished", restore: "Restored", delete: "Resource deleted", update: "Resource saved" }[op] || "Done", entityId: () => id, revalidate: CREVAL });
}
export async function addResource(formData: FormData) {
  await adminAction("caribbean", "cc_resource", "create", async (user) => {
    const name = str(formData.get("name")); if (!name) throw new Error("Name is required");
    const [r] = await db.insert(ccResources).values({ name, category: str(formData.get("category")) || "Community", country: str(formData.get("country")) || "Jamaica", area: strOrNull(formData.get("area")), type: strOrNull(formData.get("type")), url: strOrNull(formData.get("url")), description: str(formData.get("description")) || name, status: "published", kind: "curated", publishedAt: new Date(), reviewedBy: user.id, submittedByName: user.name }).returning();
    return r;
  }, { back: "/admin/caribbean?tab=resources", ok: "Resource added and published", entityId: (r) => r.id, revalidate: CREVAL });
}
export async function eventAction(formData: FormData) {
  const id = parseNum(formData.get("eventId")); const op = str(formData.get("op")); const back = cback(formData, "events");
  await adminAction("caribbean", "cc_event", op, async (user) => {
    const e = await db.query.ccEvents.findFirst({ where: eq(ccEvents.id, id) }); if (!e) throw new Error("Event not found");
    const note = strOrNull(formData.get("note"));
    if (op === "approve" || op === "restore") {
      await db.update(ccEvents).set({ status: "published", publishedAt: e.publishedAt || new Date(), reviewedBy: user.id, reviewNote: note, updatedAt: new Date() }).where(eq(ccEvents.id, id));
      if (op === "approve" && e.submittedByEmail) await sendEmail({ to: e.submittedByEmail, from: "support", subject: `Listed: ${e.title}`, text: `“${e.title}” is now listed on Caribbean Connection → Community events.\n\n${env.baseUrl}/caribbean-connection#events\n\nGrace In Design` });
      if (op === "approve") await emitEvent("cc.submission.published", { type: "event", id, title: e.title });
    } else if (op === "reject") {
      await db.update(ccEvents).set({ status: "rejected", reviewedBy: user.id, reviewNote: note, updatedAt: new Date() }).where(eq(ccEvents.id, id));
      if (e.submittedByEmail) await sendEmail({ to: e.submittedByEmail, from: "support", subject: `About your event submission: ${e.title}`, text: `Thank you for submitting “${e.title}”. We weren't able to list it this time.${note ? `\n\nReason: ${note}` : ""}\n\nGrace In Design` });
    } else if (op === "unlist") await db.update(ccEvents).set({ status: "pending", reviewedBy: user.id, updatedAt: new Date() }).where(eq(ccEvents.id, id));
    else if (op === "delete") await db.delete(ccEvents).where(eq(ccEvents.id, id));
    else if (op === "update") { const date = str(formData.get("date")); await db.update(ccEvents).set({ title: str(formData.get("title")) || e.title, startsAt: date ? new Date(`${date}T12:00:00-05:00`) : e.startsAt, timeLabel: strOrNull(formData.get("timeLabel")), whereLabel: str(formData.get("whereLabel")) || e.whereLabel, format: str(formData.get("format")) || e.format, host: str(formData.get("host")) || e.host, url: strOrNull(formData.get("url")), cost: str(formData.get("cost")) || e.cost, description: str(formData.get("description")) || e.description, country: str(formData.get("country")) || e.country, updatedAt: new Date() }).where(eq(ccEvents.id, id)); }
    return id;
  }, { back, ok: { approve: "Listed — submitter emailed", reject: "Rejected — submitter emailed", unlist: "Unlisted", restore: "Restored", delete: "Event deleted", update: "Event saved" }[op] || "Done", entityId: () => id, revalidate: CREVAL });
}
export async function addEvent(formData: FormData) {
  await adminAction("caribbean", "cc_event", "create", async (user) => {
    const title = str(formData.get("title")); const date = str(formData.get("date")); if (!title || !date) throw new Error("Title and date are required");
    const [e] = await db.insert(ccEvents).values({ title, startsAt: new Date(`${date}T12:00:00-05:00`), timeLabel: strOrNull(formData.get("timeLabel")), whereLabel: str(formData.get("whereLabel")) || "Online", format: str(formData.get("format")) || "virtual", host: str(formData.get("host")) || "Grace In Design", url: strOrNull(formData.get("url")), cost: str(formData.get("cost")) || "Free", description: str(formData.get("description")) || title, country: str(formData.get("country")) || "Jamaica", status: "published", publishedAt: new Date(), reviewedBy: user.id, submittedByName: "Grace In Design" }).returning();
    return e;
  }, { back: "/admin/caribbean?tab=events", ok: "Event added and listed", entityId: (e) => e.id, revalidate: CREVAL });
}
export async function countryAction(formData: FormData) {
  const op = str(formData.get("op"));
  await adminAction("caribbean", "cc_country", op, async () => {
    if (op === "add") { const name = str(formData.get("name")); if (!name) throw new Error("Country name is required"); const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(ccCountries); await db.insert(ccCountries).values({ name, status: "planned", sort: Number(n) }).onConflictDoNothing(); return name; }
    const id = parseNum(formData.get("countryId"));
    if (op === "status") await db.update(ccCountries).set({ status: ["live", "next", "planned"].includes(str(formData.get("status"))) ? str(formData.get("status")) : "planned" }).where(eq(ccCountries.id, id));
    else if (op === "delete") { const c = await db.query.ccCountries.findFirst({ where: eq(ccCountries.id, id) }); if (c?.name === "Jamaica") throw new Error("Jamaica is the launch country and can't be removed"); await db.delete(ccCountries).where(eq(ccCountries.id, id)); }
    return id;
  }, { back: "/admin/caribbean?tab=countries", ok: op === "add" ? "Country added" : op === "delete" ? "Country removed" : "Country updated", entityId: (k) => k, revalidate: CREVAL });
}
export async function subscriberAction(formData: FormData) {
  const op = str(formData.get("op")); const list = str(formData.get("list")) === "newsletter" ? "newsletter" : "cc";
  const id = parseNum(formData.get("subscriberId"));
  await adminAction("caribbean", list === "cc" ? "cc_subscriber" : "newsletter_subscriber", op, async () => {
    if (list === "cc") { if (op === "delete") await db.delete(ccSubscribers).where(eq(ccSubscribers.id, id)); else if (op === "unsubscribe") await db.update(ccSubscribers).set({ unsubscribedAt: new Date() }).where(eq(ccSubscribers.id, id)); else if (op === "resubscribe") await db.update(ccSubscribers).set({ unsubscribedAt: null }).where(eq(ccSubscribers.id, id)); }
    else { if (op === "delete") await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.id, id)); else if (op === "unsubscribe") await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(eq(newsletterSubscribers.id, id)); else if (op === "resubscribe") await db.update(newsletterSubscribers).set({ unsubscribedAt: null }).where(eq(newsletterSubscribers.id, id)); }
    return id;
  }, { back: backTo(formData, "/admin/caribbean?tab=subscribers"), ok: op === "delete" ? "Subscriber deleted" : "Subscriber updated", entityId: () => id, revalidate: CREVAL });
}
/** "Compose issue": queue one email per active subscriber (optionally one segment). Delivery runs through the outbox. */
export async function composeIssue(formData: FormData) {
  await adminAction("caribbean", "cc_subscriber", "compose_issue", async () => {
    const subject = str(formData.get("subject")); const body = str(formData.get("body")); if (!subject || !body) throw new Error("Subject and body are required");
    const segment = strOrNull(formData.get("segment"));
    const rows = await db.select({ email: ccSubscribers.email }).from(ccSubscribers).where(and(sql`${ccSubscribers.unsubscribedAt} is null`, segment ? eq(ccSubscribers.segment, segment) : sql`true`));
    if (!rows.length) throw new Error("No active subscribers in that segment");
    if (bool(formData.get("test"))) { const to = str(formData.get("testEmail")); if (!to) throw new Error("Enter a test address"); await sendEmail({ to, from: "newsletter", subject: `[TEST] ${subject}`, text: body }); return 1; }
    let n = 0;
    for (const r of rows) { await db.insert(outbox).values({ channel: "email", toAddr: r.email, fromAddr: env.senders.newsletter.formatted, subject, bodyText: `${body}\n\n—\nUnsubscribe: ${env.baseUrl}/unsubscribe?e=${encodeURIComponent(r.email)}&list=cc`, relatedType: "cc_issue", status: "queued" }); n++; }
    return n;
  }, { back: "/admin/caribbean?tab=subscribers", ok: "Issue queued — the outbox job delivers it", entityId: (n) => n, revalidate: ["/admin/caribbean", "/admin/ops"] });
}
