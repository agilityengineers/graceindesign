import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, paths } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import { createLead } from "@/lib/actions/leads";
export const metadata = { title: "Add lead" };
export default async function NewLeadPage() {
  const user = await requireArea("leads");
  const pathRows = await db.select().from(paths).orderBy(asc(paths.sort));
  return (
    <AdminShell user={user} active="leads" title="Add a lead" subtitle="For phone calls, referrals and walk-ins">
      <Card style={{ maxWidth: 720 }}>
        <form action={createLead} className="g2" style={{ gap: 14 }}>
          <label className="label label-caps">Name<input name="name" required className="admin-input" /></label>
          <label className="label label-caps">Path<select name="pathId" className="admin-input" defaultValue=""><option value="">—</option>{pathRows.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          <label className="label label-caps">Email<input name="email" type="email" className="admin-input" /></label>
          <label className="label label-caps">Phone<input name="phone" className="admin-input" /></label>
          <label className="label label-caps">Source label<input name="sourceLabel" defaultValue="Phone call" className="admin-input" /></label>
          <label className="label label-caps">Source key<input name="sourcePage" defaultValue="manual" className="admin-input" /></label>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Notes<textarea name="notes" rows={3} className="admin-input" /></label>
          <button type="submit" className="btn btn-navy" style={{ gridColumn: "1/-1", justifySelf: "start" }}>Add lead</button>
        </form>
      </Card>
    </AdminShell>
  );
}
