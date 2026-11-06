import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, partners, type Partner } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import ImagePicker from "@/components/admin/ImagePicker";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { savePartner, partnerAction } from "@/lib/actions/content";
import { PARTNER_CATEGORIES, PARTNERS_PAGE, groupPartners } from "@/lib/partners";

export const metadata = { title: "Partner directory" };
export const dynamic = "force-dynamic";
const FILTERS = ["All", "Published", "Draft"] as const;

export default async function PartnersAdmin({ searchParams }: { searchParams: Promise<{ filter?: string; edit?: string }> }) {
  const user = await requireArea("pages");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f === sp.filter) || "All";
  const editing = Number(sp.edit) || 0;
  const [rows, map] = await Promise.all([db.select().from(partners).orderBy(asc(partners.sort), asc(partners.name)), getMediaMap()]);
  const shown = filter === "All" ? rows : rows.filter((r) => r.status === filter.toLowerCase());
  const groups = groupPartners(shown);
  const categories = [...new Set([...PARTNER_CATEGORIES, ...rows.map((r) => r.category)])];
  const nPublished = rows.filter((r) => r.status === "published").length;
  const back = `/admin/content/partners?filter=${filter}`;
  const Hidden = ({ id }: { id: number }) => <><input type="hidden" name="partnerId" value={id} /><input type="hidden" name="_back" value={back} /></>;
  const Op = ({ id, op, label, muted }: { id: number; op: string; label: string; muted?: boolean }) => <form action={partnerAction}><Hidden id={id} /><input type="hidden" name="op" value={op} /><button type="submit" className={`link-btn${muted ? " link-muted" : ""}`} title={label}>{label}</button></form>;

  const Form = ({ p }: { p?: Partner }) => (
    <form action={savePartner} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 12, padding: p ? "12px 0 4px" : 0 }}>
      {p && <Hidden id={p.id} />}{!p && <input type="hidden" name="_back" value={back} />}
      <div style={{ gridRow: "span 4", display: "flex", flexDirection: "column", gap: 8 }}>
        <ImagePicker name="imageUrl" fileName="image_file" defaultValue={p?.imageUrl || ""} preview={p?.imageUrl ? resolveImg(map, p.imageUrl) : undefined} layout="stack" width={160} height={120} label="Photo or logo" />
      </div>
      <label className="label label-caps">Name (person or business)<input name="name" defaultValue={p?.name || ""} className="admin-input admin-input-sm" required placeholder="Mobility First OT" /></label>
      <label className="label label-caps">Specialty<input name="specialty" defaultValue={p?.specialty || ""} className="admin-input admin-input-sm" placeholder="Occupational therapist, CAPS" /></label>
      <label className="label label-caps">Category<input name="category" list="partner-cats" defaultValue={p?.category || ""} className="admin-input admin-input-sm" placeholder="Pick or type a category" required /></label>
      <label className="label label-caps">Website<input name="url" defaultValue={p?.url || ""} className="admin-input admin-input-sm" placeholder="https://example.com" /></label>
      <label className="label label-caps">Location (optional)<input name="location" defaultValue={p?.location || ""} className="admin-input admin-input-sm" placeholder="Atlanta, GA" /></label>
      <label className="label label-caps">Status<select name="status" defaultValue={p?.status === "published" ? "published" : p ? "draft" : "published"} className="admin-input admin-input-sm"><option value="published">Published (on the site)</option><option value="draft">Draft (hidden)</option></select></label>
      <label className="label label-caps" style={{ gridColumn: "2/-1" }}>Brief description<textarea name="description" rows={3} defaultValue={p?.description || ""} className="admin-input" placeholder="Two or three sentences: what they do and how they help people stay home safely." /></label>
      <div style={{ gridColumn: "2/-1", display: "flex", justifyContent: "flex-end" }}><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>{p ? "Save changes" : "+ Add listing"}</button></div>
    </form>
  );

  return (
    <AdminShell user={user} active="cms" title="Partner directory" subtitle="The professionals and businesses listed on the AIP Partners page" actions={<ContentTabs active="partners" />}>
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="On the site" value={nPublished} delta={`${rows.length - nPublished} draft`} />
        <Stat label="Categories" value={groupPartners(rows.filter((r) => r.status === "published")).length} delta="shown as filters on the page" />
      </div>
      <Card title="Listings" sub="Grouped by category, in the order they appear on the page. Use ↑ ↓ to reorder within a category." action={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {FILTERS.map((f) => <Link key={f} href={`/admin/content/partners?filter=${f}`} className={`pill${filter === f ? " is-on" : ""}`}>{f}</Link>)}
          <Link href={PARTNERS_PAGE.slug} target="_blank" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>View page ↗</Link>
        </div>}>
        {groups.map(([cat, list]) => (
          <div key={cat} style={{ display: "flex", flexDirection: "column" }}>
            <span className="eyebrow eyebrow-sm" style={{ padding: "14px 0 6px", color: "#6b7486" }}>{cat} · {list.length}</span>
            {list.map((p, i) => (
              <details key={p.id} open={editing === p.id} style={{ borderBottom: "1px solid #f2f4f7", padding: "8px 0" }}>
                <summary style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 2fr) minmax(0, 1fr) 90px auto", gap: 12, alignItems: "center", fontSize: 13, cursor: "pointer", listStyle: "none" }}>
                  {p.imageUrl ? <img src={resolveImg(map, p.imageUrl)} alt="" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6 }} /> : <span style={{ width: 48, height: 36, borderRadius: 6, background: "#eef0f4" }} />}
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ fontSize: 12, color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.description || "No description yet"}</span></div>
                  <span style={{ fontSize: 12, color: "#4b5569" }}>{p.specialty || "—"}{p.url ? <><br /><span style={{ fontSize: 11, color: "#8c95a8" }}>{p.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span></> : <><br /><span style={{ fontSize: 11, color: "#9a3c1e" }}>no website</span></>}</span>
                  <StatusPill status={p.status} />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                    {i > 0 && <Op id={p.id} op="up" label="↑" muted />}{i < list.length - 1 && <Op id={p.id} op="down" label="↓" muted />}
                    {p.status === "published" ? <Op id={p.id} op="unpublish" label="Unpublish" muted /> : <Op id={p.id} op="publish" label="Publish" />}
                    <form action={partnerAction}><Hidden id={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${p.name}” permanently? Unpublish instead to hide it but keep the details.`}>Delete</ConfirmButton></form>
                  </div>
                </summary>
                <Form p={p} />
              </details>))}
          </div>))}
        {!shown.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>{rows.length ? `No ${filter.toLowerCase()} listings.` : "No listings yet. Add the first one below."}</span>}
        <span style={{ fontSize: 12, color: "#6b7486", lineHeight: 1.6 }}>Only <strong>published</strong> listings appear on the page, under filters built from their categories. Click a row to edit it. The page's heading, intro and independence note are blocks under <Link href={`/admin/content?page=${PARTNERS_PAGE.key}`} className="link-btn">Pages → AIP Partners</Link>.</span>
        <datalist id="partner-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Card>
      <Card title="Add a listing" sub="Publishes immediately unless you choose Draft"><Form /></Card>
    </AdminShell>
  );
}
