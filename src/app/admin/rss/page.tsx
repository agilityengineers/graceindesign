import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, rssSources, posts } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import AdminShell from "@/components/admin/AdminShell";
import { Card, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import { addRssSource, rssSourceAction, syncAllRssNow, saveRssSettings } from "@/lib/actions/catalog";
import { postAction } from "@/lib/actions/content";
import { fmtDate, relativeDay } from "@/lib/utils";

export const metadata = { title: "RSS feeds" };
export const dynamic = "force-dynamic";

export default async function RssAdmin() {
  const user = await requireArea("rss");
  const [sources, items, settings] = await Promise.all([db.select().from(rssSources).where(eq(rssSources.scope, "news")).orderBy(asc(rssSources.id)), db.select().from(posts).where(and(eq(posts.origin, "rss"), eq(posts.scope, "news"))).orderBy(desc(posts.publishedAt)).limit(40), getSetting("rss")]);
  return (
    <AdminShell user={user} active="rss" title="RSS feeds" subtitle="Imported articles appear on News & Insights and the homepage" actions={<form action={syncAllRssNow}><input type="hidden" name="_back" value="/admin/rss" /><button type="submit" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Sync all now</button></form>}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Feed sources">
            {sources.map((s) => (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid #f2f4f7", opacity: s.isActive ? 1 : .55 }}>
                <form action={rssSourceAction} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr) auto", gap: 8, alignItems: "center" }}>
                  <input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="update" /><input type="hidden" name="_back" value="/admin/rss" />
                  <input name="name" defaultValue={s.name} className="admin-input admin-input-sm" aria-label="Name" />
                  <input name="url" defaultValue={s.url} className="admin-input admin-input-sm" aria-label="URL" />
                  <button type="submit" className="link-btn">Save</button>
                </form>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 11, color: s.lastError ? "#9a3c1e" : "#8c95a8", flexWrap: "wrap" }}>
                  <span>{s.lastError ? `Error: ${s.lastError}` : s.lastSyncedAt ? `Synced ${relativeDay(s.lastSyncedAt)} · ${s.itemCount} items imported` : "Not synced yet"}</span>
                  <span style={{ display: "flex", gap: 12 }}>
                    <form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="sync" /><input type="hidden" name="_back" value="/admin/rss" /><button type="submit" className="link-btn">Sync now</button></form>
                    <form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="toggle" /><input type="hidden" name="_back" value="/admin/rss" /><button type="submit" className="link-btn link-muted">{s.isActive ? "Pause" : "Resume"}</button></form>
                    <form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value="/admin/rss" /><ConfirmButton message={`Remove the ${s.name} feed? Imported posts stay.`}>Remove</ConfirmButton></form>
                  </span>
                </div>
              </div>))}
            <form action={addRssSource} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr) auto", gap: 8, alignItems: "center", paddingTop: 8 }}>
              <input type="hidden" name="scope" value="news" />
              <input name="name" placeholder="Feed name" className="admin-input admin-input-sm" />
              <input name="url" placeholder="https://example.com/feed.xml" className="admin-input admin-input-sm" required />
              <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Add feed</button>
            </form>
          </Card>
          <Card title="Latest imported items" sub="Unpublish anything that doesn't fit; edit to add your own take">
            {items.map((p) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 100px auto", gap: 12, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{p.category} · {p.publishedAt ? fmtDate(p.publishedAt) : ""} · {p.sourceName}</span></div>
                <StatusPill status={p.status} />
                <div style={{ display: "flex", gap: 10 }}>
                  <Link href={`/admin/content/posts/${p.id}`} className="link-btn">Edit</Link>
                  <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value={p.status === "published" ? "unpublish" : "publish"} /><input type="hidden" name="_back" value="/admin/rss" /><button type="submit" className="link-btn link-muted">{p.status === "published" ? "Unpublish" : "Publish"}</button></form>
                  <form action={postAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value="/admin/rss" /><ConfirmButton message="Delete this imported item?">Delete</ConfirmButton></form>
                </div>
              </div>))}
            {!items.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No items imported yet — add a feed and sync.</span>}
          </Card>
        </div>
        <Card title="Display settings">
          <form action={saveRssSettings} style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            <label className="label label-caps">Refresh every<select name="refreshHours" defaultValue={settings.refreshHours} className="admin-input admin-input-sm"><option value={1}>Hour</option><option value={6}>6 hours</option><option value={24}>Day</option></select></label>
            <label className="label label-caps">Items on homepage<select name="homepageItems" defaultValue={settings.homepageItems} className="admin-input admin-input-sm"><option value={3}>3</option><option value={6}>6</option></select></label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Use feed image as card photo<input type="checkbox" name="useFeedImage" defaultChecked={settings.useFeedImage} /></label>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Fallback to a Grace In Design photo<input type="checkbox" name="fallbackImage" defaultChecked={settings.fallbackImage} /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save</button>
            <span style={{ fontSize: 12, color: "#6b7486" }}>Scheduled sync runs via the <code>rss</code> cron job (see Client ops → Scheduled jobs).</span>
            <Link href="/news" target="_blank" className="link-btn" style={{ fontSize: 12 }}>Preview News page →</Link>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
