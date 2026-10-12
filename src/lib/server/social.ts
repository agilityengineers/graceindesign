// server-only (also used by scripts/cron.ts)
/**
 * Phase 3 — social publishing. Network adapters talk to the real APIs when an account is
 * connected (tokens stored encrypted). Without a connection the post is marked failed with a
 * clear reason so the content calendar still works end to end.
 */
import { and, eq, lte, desc } from "drizzle-orm";
import { db, socialAccounts, socialPosts, socialFeedItems, posts } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/server/settings";

export const NETWORKS = ["facebook", "instagram", "linkedin", "pinterest", "youtube"] as const;
export type Network = (typeof NETWORKS)[number];
export const NETWORK_LABELS: Record<Network, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", pinterest: "Pinterest", youtube: "YouTube" };

type PublishResult = { status: "published" | "failed"; id?: string; url?: string; error?: string };
type Account = typeof socialAccounts.$inferSelect;

async function token(acc: Account) { return decrypt(acc.accessTokenEnc); }

const adapters: Record<Network, (acc: Account, p: { body: string; imageUrl: string | null; linkUrl: string | null }) => Promise<PublishResult>> = {
  async facebook(acc, p) {
    const t = await token(acc); if (!t || !acc.externalId) return { status: "failed", error: "Facebook page not connected" };
    const endpoint = p.imageUrl ? `https://graph.facebook.com/v19.0/${acc.externalId}/photos` : `https://graph.facebook.com/v19.0/${acc.externalId}/feed`;
    const body = new URLSearchParams(p.imageUrl ? { url: abs(p.imageUrl), caption: p.body, access_token: t } : { message: p.body, ...(p.linkUrl ? { link: p.linkUrl } : {}), access_token: t });
    const r = await fetch(endpoint, { method: "POST", body }); const j: any = await r.json();
    return r.ok && j.id ? { status: "published", id: j.id, url: `https://facebook.com/${j.post_id || j.id}` } : { status: "failed", error: j.error?.message || `HTTP ${r.status}` };
  },
  async instagram(acc, p) {
    const t = await token(acc); if (!t || !acc.externalId) return { status: "failed", error: "Instagram account not connected" };
    if (!p.imageUrl) return { status: "failed", error: "Instagram requires an image" };
    const c = await fetch(`https://graph.facebook.com/v19.0/${acc.externalId}/media`, { method: "POST", body: new URLSearchParams({ image_url: abs(p.imageUrl), caption: p.body, access_token: t }) }); const cj: any = await c.json();
    if (!c.ok || !cj.id) return { status: "failed", error: cj.error?.message || `HTTP ${c.status}` };
    const pub = await fetch(`https://graph.facebook.com/v19.0/${acc.externalId}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: cj.id, access_token: t }) }); const pj: any = await pub.json();
    return pub.ok && pj.id ? { status: "published", id: pj.id, url: `https://instagram.com/p/${pj.id}` } : { status: "failed", error: pj.error?.message || `HTTP ${pub.status}` };
  },
  async linkedin(acc, p) {
    const t = await token(acc); if (!t || !acc.externalId) return { status: "failed", error: "LinkedIn not connected" };
    const author = acc.externalId.startsWith("urn:") ? acc.externalId : `urn:li:organization:${acc.externalId}`;
    const payload = { author, lifecycleState: "PUBLISHED", specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: p.body }, shareMediaCategory: p.linkUrl ? "ARTICLE" : "NONE", ...(p.linkUrl ? { media: [{ status: "READY", originalUrl: p.linkUrl }] } : {}) } }, visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" } };
    const r = await fetch("https://api.linkedin.com/v2/ugcPosts", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json", "X-Restli-Protocol-Version": "2.0.0" }, body: JSON.stringify(payload) });
    const id = r.headers.get("x-restli-id") || undefined;
    return r.ok ? { status: "published", id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined } : { status: "failed", error: `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` };
  },
  async pinterest(acc, p) {
    const t = await token(acc); if (!t) return { status: "failed", error: "Pinterest not connected" };
    if (!p.imageUrl) return { status: "failed", error: "Pinterest requires an image" };
    const boardId = (acc.meta as any)?.boardId; if (!boardId) return { status: "failed", error: "Pick a default board in Social settings" };
    const r = await fetch("https://api.pinterest.com/v5/pins", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ board_id: boardId, title: p.body.slice(0, 100), description: p.body, link: p.linkUrl || env.baseUrl, media_source: { source_type: "image_url", url: abs(p.imageUrl) } }) });
    const j: any = await r.json();
    return r.ok && j.id ? { status: "published", id: j.id, url: `https://www.pinterest.com/pin/${j.id}/` } : { status: "failed", error: j.message || `HTTP ${r.status}` };
  },
  async youtube() { return { status: "failed", error: "YouTube publishing requires a video upload — use YouTube Studio; stats sync is supported." }; },
};
const abs = (u: string) => (u.startsWith("http") ? u : `${env.baseUrl}${u}`);

export async function publishSocialPost(id: number) {
  const p = await db.query.socialPosts.findFirst({ where: eq(socialPosts.id, id) }); if (!p) return null;
  await db.update(socialPosts).set({ status: "publishing" }).where(eq(socialPosts.id, id));
  const results: Record<string, PublishResult> = { ...(p.results as any) };
  for (const n of p.networks as Network[]) {
    if (results[n]?.status === "published") continue;
    const acc = await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.network, n) });
    results[n] = acc && acc.status === "connected" && adapters[n] ? await adapters[n](acc, { body: p.body, imageUrl: p.imageUrl, linkUrl: p.linkUrl }).catch((e) => ({ status: "failed" as const, error: String(e?.message || e) })) : { status: "failed", error: `${NETWORK_LABELS[n] || n} is not connected` };
  }
  const allOk = (p.networks as string[]).every((n) => results[n]?.status === "published");
  await db.update(socialPosts).set({ results, status: allOk ? "published" : "failed", publishedAt: allOk ? new Date() : p.publishedAt, updatedAt: new Date() }).where(eq(socialPosts.id, id));
  return results;
}

export async function dispatchDueSocialPosts() {
  const due = await db.select({ id: socialPosts.id }).from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, new Date()))).limit(20);
  for (const d of due) await publishSocialPost(d.id);
  return due.length;
}

/** Auto-share a newly published blog post to the networks enabled in settings. */
export async function autoShareBlogPost(postId: number, userId?: number | null) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) }); if (!post || post.autoShared) return null;
  const s = await getSetting("social");
  const networks = (Object.entries(s.autoShare).filter(([, on]) => on).map(([n]) => n) as Network[]);
  if (!networks.length) return null;
  const link = `${env.baseUrl}/news/${post.slug}`;
  const [row] = await db.insert(socialPosts).values({ body: `New on the blog: ${post.title}\n\n${post.excerpt || ""}\n${link}`.trim(), imageUrl: post.imageUrl?.startsWith("media://") ? null : post.imageUrl, linkUrl: link, networks, scheduledAt: new Date(), status: "scheduled", originPostId: post.id, createdBy: userId ?? null }).returning();
  await db.update(posts).set({ autoShared: true }).where(eq(posts.id, post.id));
  return row;
}

/** Pull the latest Instagram media for the on-site feed block + refresh follower counts. */
export async function syncSocialFeeds() {
  const ig = await db.query.socialAccounts.findFirst({ where: eq(socialAccounts.network, "instagram") });
  let items = 0;
  if (ig && ig.status === "connected" && ig.externalId) {
    const t = await token(ig);
    if (t) {
      const r = await fetch(`https://graph.facebook.com/v19.0/${ig.externalId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,media_type&limit=12&access_token=${encodeURIComponent(t)}`);
      const j: any = await r.json();
      for (const m of j.data || []) { await db.insert(socialFeedItems).values({ network: "instagram", externalId: m.id, imageUrl: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, permalink: m.permalink, caption: m.caption || null, postedAt: m.timestamp ? new Date(m.timestamp) : null }).onConflictDoUpdate({ target: socialFeedItems.externalId, set: { imageUrl: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url, caption: m.caption || null, syncedAt: new Date() } }); items++; }
      const f = await fetch(`https://graph.facebook.com/v19.0/${ig.externalId}?fields=followers_count&access_token=${encodeURIComponent(t)}`); const fj: any = await f.json();
      if (fj.followers_count != null) await db.update(socialAccounts).set({ followers: fj.followers_count, lastSyncedAt: new Date() }).where(eq(socialAccounts.id, ig.id));
    }
  }
  return { instagramItems: items };
}

/** OAuth helpers — authorization URLs for each network (configured via env). */
export function oauthStartUrl(network: Network, state: string): string | null {
  const cb = `${env.baseUrl}/api/social/callback/${network}`;
  switch (network) {
    case "facebook": case "instagram": return env.social.meta.id ? `https://www.facebook.com/v19.0/dialog/oauth?client_id=${env.social.meta.id}&redirect_uri=${encodeURIComponent(cb)}&state=${state}&scope=${encodeURIComponent("pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management")}` : null;
    case "linkedin": return env.social.linkedin.id ? `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${env.social.linkedin.id}&redirect_uri=${encodeURIComponent(cb)}&state=${state}&scope=${encodeURIComponent("w_organization_social r_organization_social rw_organization_admin")}` : null;
    case "pinterest": return env.social.pinterest.id ? `https://www.pinterest.com/oauth/?response_type=code&client_id=${env.social.pinterest.id}&redirect_uri=${encodeURIComponent(cb)}&state=${state}&scope=${encodeURIComponent("boards:read,pins:read,pins:write")}` : null;
    case "youtube": return env.social.youtube.id ? `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${env.social.youtube.id}&redirect_uri=${encodeURIComponent(cb)}&state=${state}&access_type=offline&prompt=consent&scope=${encodeURIComponent("https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload")}` : null;
  }
}

export async function exchangeOauthCode(network: Network, code: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; externalId?: string; displayName?: string; followers?: number } | null> {
  const cb = `${env.baseUrl}/api/social/callback/${network}`;
  const form = (o: Record<string, string>) => new URLSearchParams(o);
  try {
    if (network === "facebook" || network === "instagram") {
      const r = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${env.social.meta.id}&client_secret=${env.social.meta.secret}&redirect_uri=${encodeURIComponent(cb)}&code=${code}`); const j: any = await r.json(); if (!j.access_token) return null;
      const pages = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,followers_count},followers_count&access_token=${j.access_token}`); const pj: any = await pages.json(); const page = pj.data?.[0]; if (!page) return { accessToken: j.access_token };
      if (network === "facebook") return { accessToken: page.access_token, externalId: page.id, displayName: page.name, followers: page.followers_count };
      const ig = page.instagram_business_account; return ig ? { accessToken: page.access_token, externalId: ig.id, displayName: ig.username ? `@${ig.username}` : "Instagram", followers: ig.followers_count } : null;
    }
    if (network === "linkedin") {
      const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", { method: "POST", body: form({ grant_type: "authorization_code", code, redirect_uri: cb, client_id: env.social.linkedin.id, client_secret: env.social.linkedin.secret }) }); const j: any = await r.json(); if (!j.access_token) return null;
      const orgs = await fetch("https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&projection=(elements*(organization~(localizedName)))", { headers: { authorization: `Bearer ${j.access_token}` } }); const oj: any = await orgs.json().catch(() => ({})); const el = oj.elements?.[0];
      return { accessToken: j.access_token, expiresIn: j.expires_in, externalId: el?.organization, displayName: el?.["organization~"]?.localizedName || "LinkedIn" };
    }
    if (network === "pinterest") {
      const r = await fetch("https://api.pinterest.com/v5/oauth/token", { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${env.social.pinterest.id}:${env.social.pinterest.secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" }, body: form({ grant_type: "authorization_code", code, redirect_uri: cb }) }); const j: any = await r.json(); if (!j.access_token) return null;
      const me = await fetch("https://api.pinterest.com/v5/user_account", { headers: { authorization: `Bearer ${j.access_token}` } }); const mj: any = await me.json().catch(() => ({}));
      return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, externalId: mj.username, displayName: mj.username ? `@${mj.username}` : "Pinterest", followers: mj.follower_count };
    }
    if (network === "youtube") {
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: form({ grant_type: "authorization_code", code, redirect_uri: cb, client_id: env.social.youtube.id, client_secret: env.social.youtube.secret }) }); const j: any = await r.json(); if (!j.access_token) return null;
      const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", { headers: { authorization: `Bearer ${j.access_token}` } }); const cj: any = await ch.json().catch(() => ({})); const c = cj.items?.[0];
      return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, externalId: c?.id, displayName: c?.snippet?.title || "YouTube", followers: Number(c?.statistics?.subscriberCount || 0) };
    }
  } catch { return null; }
  return null;
}

export async function saveConnectedAccount(network: Network, t: NonNullable<Awaited<ReturnType<typeof exchangeOauthCode>>>) {
  await db.insert(socialAccounts).values({ network, displayName: t.displayName, externalId: t.externalId, accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null, tokenExpiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null, status: "connected", followers: t.followers ?? null, connectedAt: new Date() })
    .onConflictDoUpdate({ target: socialAccounts.network, set: { displayName: t.displayName, externalId: t.externalId, accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null, tokenExpiresAt: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000) : null, status: "connected", followers: t.followers ?? null, connectedAt: new Date(), updatedAt: new Date() } });
}
export { desc };
