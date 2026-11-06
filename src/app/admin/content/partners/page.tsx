import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, aipPartners } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import ImagePicker from "@/components/admin/ImagePicker";
import ContentTabs from "@/components/admin/ContentTabs";
import { AIP_PARTNER_CATEGORIES, AIP_PARTNER_RELATIONSHIPS, aipPartnerCategoryLabel, aipPartnerRelationshipLabel } from "@/lib/aip-partners";
import { saveAipPartner, aipPartnerAction, reorderAipPartners } from "@/lib/actions/content";

export const metadata = { title: "AIP Partners" };
export const dynamic = "force-dynamic";

export default async function AipPartnersAdmin() {
  const user = await requireArea("pages");
  const [rows, map] = await Promise.all([db.select().from(aipPartners).orderBy(asc(aipPartners.sort), asc(aipPartners.id)), getMediaMap()]);
  const shown = rows.filter((r) => r.visible).length;
  const Form = ({ p, compact }: { p?: typeof rows[number]; compact?: boolean }) => { const wide = compact ? "1/-1" : "2/-1"; return (
    <form action={saveAipPartner} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "120px 1fr 1fr", gap: 10, padding: 12, borderRadius: 12, border: "1px solid #eef0f4", background: p && !p.visible ? "#f7f9fc" : "#fff" }}>
      {p && <input type="hidden" name="partnerId" value={p.id} />}
      <div style={compact ? undefined : { gridRow: "span 5" }}><ImagePicker name="logoUrl" fileName="logo_file" label="Logo or photo (optional)" defaultValue={p?.logoUrl || ""} preview={p?.logoUrl ? resolveImg(map, p.logoUrl) : undefined} layout="stack" width={120} height={90} /></div>
      <label className="label label-caps">Business or professional name<input name="name" defaultValue={p?.name || ""} className="admin-input admin-input-sm" placeholder="Mobility First OT" required /></label>
      <label className="label label-caps">Category<select name="category" defaultValue={p?.category || ""} className="admin-input admin-input-sm" required><option value="" disabled>Choose a category…</option>{AIP_PARTNER_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
      <label className="label label-caps">Type of service<input name="serviceType" defaultValue={p?.serviceType || ""} className="admin-input admin-input-sm" placeholder="Occupational therapy" /></label>
      <label className="label label-caps">Relationship<select name="relationship" defaultValue={p?.relationship || "known"} className="admin-input admin-input-sm">{AIP_PARTNER_RELATIONSHIPS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
      <label className="label label-caps" style={{ gridColumn: wide }}>Service area<input name="serviceArea" defaultValue={p?.serviceArea || ""} className="admin-input admin-input-sm" placeholder="Metro Atlanta · or “Virtual”" /></label>
      <label className="label label-caps" style={{ gridColumn: wide }}>Short description<textarea name="description" rows={2} maxLength={400} defaultValue={p?.description || ""} className="admin-input" placeholder="One or two sentences on what they do and who they help." /></label>
      <label className="label label-caps" style={{ gridColumn: wide }}>Website<input name="websiteUrl" defaultValue={p?.websiteUrl || ""} className="admin-input admin-input-sm" placeholder="example.com" /></label>
      <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="visible" defaultChecked={p ? p.visible : true} />Shown on the AIP Partners page</label>
        <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>{p ? "Save" : "+ Add partner"}</button>
      </div>
    </form>
  ); };
  return (
    <AdminShell user={user} active="cms" title="AIP Partners" subtitle="Trusted professionals listed on the AIP Partners page" actions={<ContentTabs active="partners" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Directory" sub={rows.length ? `${shown} of ${rows.length} shown · drag to reorder` : "No partners yet"} action={<a href="/healthy-home-resources/aip-partners#partners" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#3f9ad9" }}>View page →</a>}>
          {rows.length ? (
            <Sortable ids={rows.map((r) => r.id)} onReorder={reorderAipPartners} handleTop>
              {rows.map((p) => (
                <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#8c95a8" }}>{aipPartnerCategoryLabel(p.category)} · {aipPartnerRelationshipLabel(p.relationship)}{p.visible ? "" : " · hidden"}</span>
                  <Form p={p} />
                  <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
                    <form action={aipPartnerAction}><input type="hidden" name="partnerId" value={p.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>{p.visible ? "Hide" : "Show"}</button></form>
                    <form action={aipPartnerAction}><input type="hidden" name="partnerId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove ${p.name} from the directory?`}>Remove</ConfirmButton></form>
                  </div>
                </div>))}
            </Sortable>
          ) : <p style={{ fontSize: 13, color: "#6b7486" }}>Add your first partner on the right. The directory section stays off the public page until at least one partner is shown.</p>}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Add a partner"><Form compact /></Card>
          <Card title="Relationship" sub="Shown as a badge on each card">
            <ul style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#4b5569", listStyle: "none", padding: 0, margin: 0 }}>
              {AIP_PARTNER_RELATIONSHIPS.map((r) => <li key={r.key}><strong style={{ color: "#1a2238" }}>{r.label}</strong> — {r.hint}</li>)}
            </ul>
          </Card>
          <Card title="Categories" sub="Visitors filter the directory by these">
            <ul style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#4b5569", listStyle: "none", padding: 0, margin: 0 }}>
              {AIP_PARTNER_CATEGORIES.map((c) => <li key={c.key}><strong style={{ color: "#1a2238" }}>{c.label}</strong> — {c.hint} <span style={{ color: "#8c95a8" }}>({rows.filter((r) => r.category === c.key).length})</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
