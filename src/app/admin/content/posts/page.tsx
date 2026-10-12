import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, posts } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import AdminShell from "@/components/admin/AdminShell";
import { Card, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { postAction } from "@/lib/actions/content";
import { saveSocialSettings } from "@/lib/actions/settings";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "News & Insights" };
export const dynamic = "force-dynamic";

export default async function PostsAdmin({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireArea("posts");
  const sp = await searchParams;
  const [rows, social] = await Promise.all([db.select().from(posts).orderBy(desc(posts.publishedAt), desc(posts.createdAt)).limit(300), getSetting("social")]);
  const filter = sp.filter || "All";
  const list = rows.filter((p) => filter === "All" ? true : filter === "Written" ? p.origin === "written" : filter === "RSS" ? p.origin === "rss" : filter === "Drafts" ? p.status === "draft" : filter === "Caribbean" ? p.scope === "caribbean" : true);
  return (
    <AdminShell user={user} active="cms" title="News & Insights" subtitle="Written posts and RSS imports in one list" actions={<ContentTabs active="posts" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Posts" action={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{["All", "Written", "RSS", "Drafts", "Caribbean"].map((f) => <Link key={f} href={`/admin/content/posts?filter=${f}`} className={`pill${filter === f ? " is-on" : ""}`}>{f}</Link>)}<Link href="/admin/content/posts/new" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>+ Write post</Link></div>}>
          {list.map((p) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 90px 100px auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f2f4f7", fontSize: 13 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.featured && <span className="tag" style={{ marginRight: 6, background: "#fff4d6", color: "#7a5a00" }}>featured</span>}{p.title}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{p.category} · {p.publishedAt ? fmtDate(p.publishedAt) : "unpublished"}{p.scope === "caribbean" ? " · Caribbean" : ""}{p.sourceName ? ` · ${p.sourceName}` : ""}</span></div>
              <span className="tag">{p.origin === "rss" ? "RSS" : "Written"}</span>
              <StatusPill status={p.status} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Link href={`/admin/content/posts/${p.id}`} className="link-btn">Edit</Link>
                {p.status === "published" && <a href={`/news/${p.slug}`} target="_blank" rel="noreferrer" className="link-btn link-muted">View</a>}
                <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="share" /><button type="submit" className="link-btn link-muted" title="Queue a social post for this article">Share</button></form>
                <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value={p.status === "published" ? "unpublish" : "publish"} /><button type="submit" className="link-btn link-muted">{p.status === "published" ? "Unpublish" : "Publish"}</button></form>
                <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="feature" /><button type="submit" className="link-btn link-muted">{p.featured ? "Unfeature" : "Feature"}</button></form>
                <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${p.title}”?`}>Delete</ConfirmButton></form>
              </div>
            </div>))}
          {!list.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing here yet.</span>}
        </Card>
        <Card title="Auto-share" sub="When a post is published">
          <form action={saveSocialSettings} style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <input type="hidden" name="_back" value="/admin/content/posts" /><input type="hidden" name="showInstagramFeed" value={social.showInstagramFeed ? "on" : ""} /><input type="hidden" name="feedCount" value={social.feedCount} />
            {([["as_facebook", "Post to Facebook", social.autoShare.facebook], ["as_linkedin", "Post to LinkedIn", social.autoShare.linkedin], ["as_instagram", "Post to Instagram (image + caption)", social.autoShare.instagram], ["as_pinterest", "Pin to Pinterest", social.autoShare.pinterest]] as [string, string, boolean][]).map(([k, l, v]) => <label key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{l}<input type="checkbox" name={k} defaultChecked={v} /></label>)}
            <span className="tag" style={{ alignSelf: "flex-start", background: "#e9e4fb", color: "#4a2fa3" }}>PHASE 3 · social connections required</span>
            <span style={{ fontSize: 12, color: "#6b7486" }}>Shares are queued as social posts; connect networks under Social media → Accounts for them to go out.</span>
            <button type="submit" className="btn btn-navy btn-xs" style={{ alignSelf: "flex-start", borderRadius: 8 }}>Save</button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
