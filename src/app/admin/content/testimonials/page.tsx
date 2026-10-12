import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, testimonials, services } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import ContentTabs from "@/components/admin/ContentTabs";
import { saveTestimonial, testimonialAction, reorderTestimonials } from "@/lib/actions/content";

export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

export default async function TestimonialsAdmin() {
  const user = await requireArea("pages");
  const [rows, svc] = await Promise.all([db.select().from(testimonials).orderBy(asc(testimonials.sort), asc(testimonials.id)), db.select({ slug: services.slug, title: services.title }).from(services).orderBy(asc(services.sort))]);
  const Form = ({ t }: { t?: typeof rows[number] }) => (
    <form action={saveTestimonial} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: 12, borderRadius: 12, border: "1px solid #eef0f4", background: t && !t.visible ? "#f7f9fc" : "#fff" }}>
      {t && <input type="hidden" name="testimonialId" value={t.id} />}
      <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Quote<textarea name="quote" rows={2} defaultValue={t?.quote || ""} className="admin-input" required /></label>
      <label className="label label-caps">Who<input name="who" defaultValue={t?.who || ""} className="admin-input admin-input-sm" placeholder="Margaret E., homeowner" /></label>
      <label className="label label-caps">Where<input name="whereLabel" defaultValue={t?.whereLabel || ""} className="admin-input admin-input-sm" placeholder="Marietta, GA" /></label>
      <label className="label label-caps">Service page<select name="serviceSlug" defaultValue={t?.serviceSlug || ""} className="admin-input admin-input-sm"><option value="">All / homepage</option>{svc.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}</select></label>
      <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="visible" defaultChecked={t ? t.visible : true} />Visible</label>
        <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>{t ? "Save" : "+ Add testimonial"}</button>
      </div>
    </form>
  );
  return (
    <AdminShell user={user} active="cms" title="Testimonials" subtitle="Shown on service pages and the homepage" actions={<ContentTabs active="testimonials" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Testimonials" sub="Drag to reorder">
          <Sortable ids={rows.map((r) => r.id)} onReorder={reorderTestimonials} handleTop>
            {rows.map((t) => <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}><Form t={t} /><form action={testimonialAction} style={{ alignSelf: "flex-end" }}><input type="hidden" name="testimonialId" value={t.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this testimonial?">Delete</ConfirmButton></form></div>)}
          </Sortable>
        </Card>
        <Card title="Add a testimonial"><Form /></Card>
      </div>
    </AdminShell>
  );
}
