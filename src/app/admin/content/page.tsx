import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, pages, pageBlocks } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import ContentTabs from "@/components/admin/ContentTabs";
import BlockEditor from "@/components/admin/BlockEditor";
import { savePageSeo, blockAction, addBlock, reorderBlocks, publishPage, discardPageDraft, createPage, deletePage } from "@/lib/actions/content";
import { relativeDay } from "@/lib/utils";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";
const BLOCK_TYPES = ["rich_text", "page_header", "cta", "steps", "news", "featured_products", "consult_form", "product_grid", "product_shelf", "service_list", "contact_steps"];
const CORE = ["home", "about", "services", "hhr", "caribbean", "news", "contact"];
const PAGE_HREF: Record<string, string> = { home: "/", about: "/about", services: "/services", hhr: "/healthy-home-resources", caribbean: "/caribbean-connection", news: "/news", contact: "/contact", "aip-products": "/healthy-home-resources/aip-products", wellness: "/healthy-home-resources/wellness", "home-health": "/healthy-home-resources/home-health-series", privacy: "/privacy", terms: "/terms", accessibility: "/accessibility" };
const preview = (c: Record<string, unknown>) => { for (const k of ["title", "lead", "kicker", "eyebrow", "heading", "body"]) { const v = c[k]; if (typeof v === "string" && v) return v.replace(/<[^>]+>/g, "").slice(0, 90); } const first = Object.values(c).find((v) => typeof v === "string" && v); return typeof first === "string" ? first.slice(0, 90) : ""; };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ page?: string; block?: string }> }) {
  const user = await requireArea("pages");
  const sp = await searchParams;
  const pageRows = await db.select().from(pages).orderBy(asc(pages.sort));
  const cur = pageRows.find((p) => p.key === sp.page) || pageRows[0];
  const blocks = cur ? await db.select().from(pageBlocks).where(eq(pageBlocks.pageId, cur.id)).orderBy(asc(pageBlocks.sort), asc(pageBlocks.id)) : [];
  const back = `/admin/content?page=${cur?.key || ""}`;
  const href = cur ? PAGE_HREF[cur.key] || `/p/${cur.key}` : "/";
  const editing = Number(sp.block) || 0;
  return (
    <AdminShell user={user} active="cms" title="Content (CMS)" subtitle="Edit copy and images inline; every section is a block" actions={<ContentTabs active="pages" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Pages">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pageRows.map((p) => <Link key={p.id} href={`/admin/content?page=${p.key}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: cur?.id === p.id ? "#1a2238" : "transparent", color: cur?.id === p.id ? "#fff" : "#1a2238", fontSize: 13 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span><span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", opacity: .75 }}>{p.hasDraft ? "Draft" : p.status === "published" ? "Published" : "Unpublished"}</span></Link>)}
          </div>
          <details style={{ borderTop: "1px solid #eef0f4", paddingTop: 10 }}>
            <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#3f9ad9" }}>+ New page</summary>
            <form action={createPage} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <input name="title" placeholder="Page title" className="admin-input admin-input-sm" required />
              <input name="key" placeholder="key (e.g. workshops)" className="admin-input admin-input-sm" />
              <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Create draft page</button>
              <span style={{ fontSize: 11, color: "#8c95a8" }}>Custom pages publish at /p/&lt;key&gt;.</span>
            </form>
          </details>
        </Card>
        {cur && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card title={cur.title} sub={`${href} · ${cur.hasDraft ? "unpublished draft changes" : `published ${cur.publishedAt ? relativeDay(cur.publishedAt) : ""}`}`} action={
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`${href}?preview=1`} target="_blank" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Preview</Link>
                {cur.hasDraft && <form action={discardPageDraft}><input type="hidden" name="pageId" value={cur.id} /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Discard all unpublished changes on this page?" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Discard draft</ConfirmButton></form>}
                <form action={publishPage}><input type="hidden" name="pageId" value={cur.id} /><input type="hidden" name="_back" value={back} /><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Publish</button></form>
              </div>}>
              <Sortable ids={blocks.map((b) => b.id)} onReorder={reorderBlocks.bind(null, cur.id)} handleTop>
                {blocks.map((b) => { const c = (b.draftContent || b.content) as Record<string, unknown>; const visible = b.draftVisible ?? b.visible; const changed = !!b.draftContent || b.draftVisible != null; return (
                  <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #eef0f4", background: visible ? "#fff" : "#f7f9fc", opacity: visible ? 1 : .7 }}>
                      <span className="tag" style={{ flex: "none", background: "#e6f3fc", color: "#1a2238" }}>{b.type.replace(/_/g, " ")}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "#4b5569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview(c)}{changed && <span className="tag" style={{ marginLeft: 8, background: "#fff4d6", color: "#7a5a00" }}>draft</span>}</span>
                      <div style={{ display: "flex", gap: 12, flex: "none" }}>
                        <Link href={`/admin/content?page=${cur.key}&block=${editing === b.id ? "" : b.id}`} className="link-btn">{editing === b.id ? "Close" : "Edit"}</Link>
                        <form action={blockAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="toggle" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">{visible ? "Hide" : "Show"}</button></form>
                        <form action={blockAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="duplicate" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">Duplicate</button></form>
                        {changed && <form action={blockAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="discard" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">Revert</button></form>}
                        <form action={blockAction}><input type="hidden" name="blockId" value={b.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Delete this block? This takes effect immediately.">Delete</ConfirmButton></form>
                      </div>
                    </div>
                    {editing === b.id && <BlockEditor blockId={b.id} type={b.type} content={c as never} back={back} />}
                  </div>); })}
              </Sortable>
              <form action={addBlock} style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 10, borderTop: "1px solid #eef0f4" }}>
                <input type="hidden" name="pageId" value={cur.id} /><input type="hidden" name="_back" value={back} />
                <select name="type" className="admin-input admin-input-sm" style={{ width: 200 }} defaultValue="rich_text">{BLOCK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select>
                <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>+ Add block</button>
                <span style={{ fontSize: 11, color: "#8c95a8" }}>New blocks start with placeholder copy and appear at the bottom.</span>
              </form>
            </Card>
            <Card title="SEO & page settings">
              <form action={savePageSeo} className="g2" style={{ gap: 10 }}>
                <input type="hidden" name="pageId" value={cur.id} /><input type="hidden" name="_back" value={back} />
                <label className="label label-caps">Page title<input name="title" defaultValue={cur.title} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Nav label / utility bar text<input name="navLabel" defaultValue={cur.navLabel || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">URL slug<input name="slug" defaultValue={cur.slug.replace(/^\//, "")} className="admin-input admin-input-sm" disabled={CORE.includes(cur.key)} /></label>
                <label className="label label-caps">Status<select name="status" defaultValue={cur.status} className="admin-input admin-input-sm"><option value="published">Published</option><option value="draft">Unpublished (404 for visitors)</option></select></label>
                <label className="label label-caps">Meta title<input name="seoTitle" defaultValue={cur.seoTitle || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Meta description<textarea name="seoDescription" rows={2} defaultValue={cur.seoDescription || ""} className="admin-input" /></label>
                <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save settings</button>
                </div>
              </form>
              {!CORE.includes(cur.key) && <form action={deletePage}><input type="hidden" name="pageId" value={cur.id} /><ConfirmButton message={`Delete the “${cur.title}” page and all its blocks?`}>Delete this page</ConfirmButton></form>}
            </Card>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
