import { desc, ilike, or } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, media } from "@/lib/db";
import { getMediaMap } from "@/lib/data/media";
import { magnificConfigured } from "@/lib/server/magnific";
import { MEDIA_SLOTS } from "@/lib/seed-data/media";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { uploadMedia, mediaAction, generateMedia } from "@/lib/actions/media";

export const metadata = { title: "Media library" };
export const dynamic = "force-dynamic";

export default async function MediaAdmin({ searchParams }: { searchParams: Promise<{ q?: string; source?: string }> }) {
  const user = await requireArea("media");
  const sp = await searchParams; const q = sp.q || "";
  const [rows, map] = await Promise.all([db.select().from(media).where(q ? or(ilike(media.name, `%${q}%`), ilike(media.slot, `%${q}%`), ilike(media.subject, `%${q}%`)) : undefined).orderBy(desc(media.updatedAt)).limit(400), getMediaMap()]);
  const list = sp.source ? rows.filter((m) => m.source === sp.source) : rows;
  const slots = MEDIA_SLOTS.map((s) => s.slot);
  const back = `/admin/content/media${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  const srcOf = (m: typeof rows[number]) => (m.slot ? map.get(m.slot) : m.url) || m.url;
  return (
    <AdminShell user={user} active="cms" title="Media library" subtitle="Photos, logos and documents used across the site" actions={<ContentTabs active="media" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20 }} className="g2">
        <Card title="Upload" sub="Pick a slot to replace an image everywhere it's used, or leave blank to add to the library">
          <form action={uploadMedia} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Files<input type="file" name="files" multiple accept="image/*,.pdf" className="admin-input admin-input-sm" style={{ paddingTop: 6 }} required /></label>
            <label className="label label-caps">Replace slot (optional)<input name="slot" list="slots" className="admin-input admin-input-sm" placeholder="e.g. int.kitchen-windows" /><datalist id="slots">{slots.map((s) => <option key={s} value={s} />)}</datalist></label>
            <label className="label label-caps">Alt text<input name="alt" className="admin-input admin-input-sm" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>Upload</button>
          </form>
        </Card>
        <Card title="Generate with Magnific" sub={magnificConfigured() ? "Describe the photo; it lands in the library (and replaces a slot if you pick one)" : "Add MAGNIFIC_API_KEY under Replit Secrets to enable generation"}>
          <form action={generateMedia} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Prompt<textarea name="prompt" rows={3} className="admin-input" placeholder="Bright, warm kitchen with large windows, natural wood and white cabinetry, editorial interior photography" required /></label>
            <label className="label label-caps">Aspect<select name="aspect" className="admin-input admin-input-sm" defaultValue="16:9">{["16:9", "4:3", "3:2", "1:1", "2:3", "9:16"].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
            <label className="label label-caps">Slot (optional)<input name="slot" list="slots" className="admin-input admin-input-sm" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }} disabled={!magnificConfigured()}>Generate</button>
          </form>
        </Card>
      </div>
      <Card title={`Library · ${list.length}`} action={<form method="get" style={{ display: "flex", gap: 8 }}><input name="q" defaultValue={q} placeholder="Search name, slot, subject" className="admin-input admin-input-sm" style={{ width: 220 }} /><select name="source" defaultValue={sp.source || ""} className="admin-input admin-input-sm" style={{ width: 130 }}><option value="">All sources</option>{["upload", "brand", "magnific", "stock", "remote"].map((s) => <option key={s} value={s}>{s}</option>)}</select><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Filter</button></form>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {list.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 12, border: "1px solid #eef0f4", background: "#fff" }}>
              <div style={{ height: 130, borderRadius: 8, overflow: "hidden", background: "#f2f4f7" }}><img src={srcOf(m)} alt={m.alt || m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
              <form action={mediaAction} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="op" value="update" /><input type="hidden" name="_back" value={back} />
                <input name="name" defaultValue={m.name} className="admin-input admin-input-sm" aria-label="Name" />
                <input name="slot" defaultValue={m.slot || ""} list="slots" placeholder="slot (optional)" className="admin-input admin-input-sm" aria-label="Slot" />
                <input name="alt" defaultValue={m.alt || ""} placeholder="Alt text" className="admin-input admin-input-sm" aria-label="Alt text" />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#8c95a8" }}><span>{m.source}{m.usedOn.length ? ` · ${m.usedOn.slice(0, 2).join(", ")}` : ""}</span><button type="submit" className="link-btn">Save</button></div>
              </form>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <form action={mediaAction} encType="multipart/form-data" style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="op" value="replace" /><input type="hidden" name="_back" value={back} /><input type="file" name="file" accept="image/*" style={{ fontSize: 10, width: 120 }} /><button type="submit" className="link-btn">Replace</button></form>
                <form action={mediaAction}><input type="hidden" name="mediaId" value={m.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message={m.slot ? `This image fills the “${m.slot}” slot — pages using it will fall back to a placeholder. Delete anyway?` : "Delete this file?"}>Delete</ConfirmButton></form>
              </div>
            </div>))}
        </div>
      </Card>
    </AdminShell>
  );
}
