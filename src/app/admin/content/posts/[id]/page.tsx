import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, posts } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ContentTabs from "@/components/admin/ContentTabs";
import { savePost } from "@/lib/actions/content";

export const dynamic = "force-dynamic";
const CATEGORIES = ["Healthy Home Resources", "Aging in Place", "Design", "Commercial", "Project Management", "Caribbean", "News", "Company"];

export default async function PostEdit({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireArea("posts");
  const { id } = await params;
  const isNew = id === "new";
  const p = isNew ? null : await db.query.posts.findFirst({ where: eq(posts.id, Number(id)) });
  if (!isNew && !p) notFound();
  const map = await getMediaMap();
  return (
    <AdminShell user={user} active="cms" title={isNew ? "Write a post" : p!.title} subtitle={isNew ? "Drafts are private until you publish" : p!.origin === "rss" ? `Imported from ${p!.sourceName}` : "Written post"} actions={<ContentTabs active="posts" />}>
      <Toast />
      <form action={savePost} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        {!isNew && <input type="hidden" name="postId" value={p!.id} />}
        <Card>
          <label className="label label-caps">Title<input name="title" defaultValue={p?.title || ""} className="admin-input" required /></label>
          <label className="label label-caps">Excerpt<textarea name="excerpt" rows={3} defaultValue={p?.excerpt || ""} className="admin-input" /></label>
          <label className="label label-caps">Body<span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#8c95a8" }}> · HTML allowed (&lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;a&gt;, &lt;img&gt;)</span><textarea name="body" rows={18} defaultValue={p?.body || ""} className="admin-input" style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }} /></label>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Publishing">
            <label className="label label-caps">Status<select name="status" defaultValue={p?.status || "draft"} className="admin-input admin-input-sm"><option value="draft">Draft</option><option value="published">Published</option></select></label>
            <label className="label label-caps">Section<select name="scope" defaultValue={p?.scope || "news"} className="admin-input admin-input-sm"><option value="news">News & Insights</option><option value="caribbean">Caribbean Blog</option></select></label>
            <label className="label label-caps">Category<input name="category" list="cats" defaultValue={p?.category || "Healthy Home Resources"} className="admin-input admin-input-sm" /><datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></label>
            <label className="label label-caps">Slug<input name="slug" defaultValue={p?.slug || ""} placeholder="auto from title" className="admin-input admin-input-sm" /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><input type="checkbox" name="featured" defaultChecked={p?.featured} />Featured (pinned first on the homepage row)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" name="intent" value="save" className="btn btn-ghost btn-sm" style={{ borderRadius: 10 }}>Save</button>
              <button type="submit" name="intent" value="publish" className="btn btn-navy btn-sm" style={{ borderRadius: 10 }}>{p?.status === "published" ? "Save & re-publish" : "Publish now"}</button>
            </div>
            <Link href="/admin/content/posts" style={{ fontSize: 12, color: "#6b7486" }}>← Back to posts</Link>
          </Card>
          <Card title="Cover image">
            <div style={{ height: 150, borderRadius: 10, overflow: "hidden", background: "#f2f4f7" }}>{p?.imageUrl && <img src={resolveImg(map, p.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
            <label className="label label-caps">Image URL or media://slot<input name="imageUrl" defaultValue={p?.imageUrl || ""} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Upload<input type="file" name="image_file" accept="image/*" className="admin-input admin-input-sm" style={{ paddingTop: 6 }} /></label>
          </Card>
          {p?.origin === "rss" && <Card title="Source"><a href={p.sourceUrl || "#"} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#3f9ad9", wordBreak: "break-all" }}>{p.sourceUrl}</a><span style={{ fontSize: 12, color: "#6b7486" }}>RSS imports link out to the original article. Add a body to turn this into a full post.</span></Card>}
        </div>
      </form>
    </AdminShell>
  );
}
