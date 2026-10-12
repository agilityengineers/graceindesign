"use server";
import { eq } from "drizzle-orm";
import { db, socialAccounts, socialPosts } from "@/lib/db";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum } from "@/lib/utils";
import { uploadToMedia } from "@/lib/server/media-upload";
import { publishSocialPost, syncSocialFeeds, NETWORKS, type Network } from "@/lib/server/social";
import { etDate } from "@/lib/server/consult";

const REVAL = ["/admin/social", "/"];

export async function createSocialPost(formData: FormData) {
  const intent = str(formData.get("intent")); // draft | schedule | now
  await adminAction("social", "social_post", "create", async (user) => {
    const body = str(formData.get("body")); if (!body) throw new Error("Write the post first");
    const networks = formData.getAll("networks").map(String).filter((n): n is Network => (NETWORKS as readonly string[]).includes(n));
    if (!networks.length && intent !== "draft") throw new Error("Pick at least one network");
    let imageUrl = strOrNull(formData.get("imageUrl")); const f = formData.get("image_file");
    if (f instanceof File && f.size > 0) imageUrl = (await uploadToMedia(f, { folder: "social", usedOn: ["Social"], userId: user.id })).url;
    let scheduledAt: Date | null = null;
    if (intent === "schedule") { const d = str(formData.get("date")); const t = str(formData.get("time")); if (!d || !t) throw new Error("Pick a date and time"); scheduledAt = etDate(d, t); if (scheduledAt.getTime() < Date.now() - 60000) throw new Error("That time is in the past"); }
    const [row] = await db.insert(socialPosts).values({ body, imageUrl, linkUrl: strOrNull(formData.get("linkUrl")), networks, scheduledAt, status: intent === "draft" ? "draft" : "scheduled", createdBy: user.id }).returning();
    if (intent === "now") { const results = (await publishSocialPost(row.id)) || {}; const failed = Object.entries(results).filter(([, r]) => r.status !== "published"); if (failed.length) throw new Error(`Saved, but ${failed.map(([n, r]) => `${n}: ${r.error}`).join("; ")}`); }
    return row;
  }, { back: "/admin/social", ok: intent === "draft" ? "Draft saved" : intent === "now" ? "Published" : "Scheduled", entityId: (r) => r.id, revalidate: REVAL });
}
export async function socialPostAction(formData: FormData) {
  const id = parseNum(formData.get("postId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/social");
  await adminAction("social", "social_post", op, async () => {
    const p = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, id) }); if (!p) throw new Error("Post not found");
    if (op === "delete") await db.delete(socialPosts).where(eq(socialPosts.id, id));
    else if (op === "publish") { const results = (await publishSocialPost(id)) || {}; const failed = Object.entries(results).filter(([, r]) => r.status !== "published"); if (failed.length) throw new Error(failed.map(([n, r]) => `${n}: ${r.error}`).join("; ")); }
    else if (op === "unschedule") await db.update(socialPosts).set({ status: "draft", scheduledAt: null, updatedAt: new Date() }).where(eq(socialPosts.id, id));
    else if (op === "reschedule") { const d = str(formData.get("date")); const t = str(formData.get("time")); if (!d || !t) throw new Error("Pick a date and time"); await db.update(socialPosts).set({ status: "scheduled", scheduledAt: etDate(d, t), updatedAt: new Date() }).where(eq(socialPosts.id, id)); }
    else if (op === "update") { const networks = formData.getAll("networks").map(String).filter((n): n is Network => (NETWORKS as readonly string[]).includes(n)); await db.update(socialPosts).set({ body: str(formData.get("body")) || p.body, linkUrl: strOrNull(formData.get("linkUrl")), networks: networks.length ? networks : p.networks, updatedAt: new Date() }).where(eq(socialPosts.id, id)); }
    return id;
  }, { back, ok: { delete: "Post deleted", publish: "Published", unschedule: "Moved back to drafts", reschedule: "Rescheduled", update: "Post saved" }[op] || "Done", entityId: () => id, revalidate: REVAL });
}
export async function disconnectSocial(formData: FormData) {
  const network = str(formData.get("network"));
  await adminAction("social", "social_account", "disconnect", async () => { await db.update(socialAccounts).set({ status: "disconnected", accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null, updatedAt: new Date() }).where(eq(socialAccounts.network, network)); return network; }, { back: "/admin/social", ok: "Disconnected", entityId: (k) => k, revalidate: REVAL });
}
export async function syncFeedsNow() {
  await adminAction("social", "social_feed", "sync", async () => syncSocialFeeds(), { back: "/admin/social", ok: "Feeds synced", revalidate: REVAL });
}
