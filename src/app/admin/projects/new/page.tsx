import { asc, desc, eq, isNull } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, leads, users, services, projectPhases, projectStages } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import { createProject } from "@/lib/actions/projects";
export const metadata = { title: "New project" };
export const dynamic = "force-dynamic";
export default async function NewProjectPage() {
  const user = await requireArea("projects");
  const [openLeads, team, svc, phases, stages] = await Promise.all([
    db.select({ id: leads.id, name: leads.name, sourceLabel: leads.sourceLabel }).from(leads).where(isNull(leads.convertedProjectId)).orderBy(desc(leads.createdAt)).limit(200),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
    db.select({ id: services.id, title: services.title }).from(services).orderBy(asc(services.sort)),
    db.select().from(projectPhases).orderBy(asc(projectPhases.sort)),
    db.select().from(projectStages).orderBy(asc(projectStages.sort)),
  ]);
  return (
    <AdminShell user={user} active="projects" title="New project" subtitle="For work that didn't start as a web lead, or to backfill history">
      <Card style={{ maxWidth: 760 }}>
        <form action={createProject} className="g2" style={{ gap: 14 }}>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Project name<input name="name" required className="admin-input" placeholder="Shah Residence — Kitchen" /></label>
          <label className="label label-caps">Link to a lead (optional)<select name="leadId" className="admin-input" defaultValue=""><option value="">— none —</option>{openLeads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.sourceLabel}</option>)}</select></label>
          <label className="label label-caps">…or client name<input name="leadName" className="admin-input" /></label>
          <label className="label label-caps">Service<select name="serviceId" className="admin-input" defaultValue="">{svc.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}<option value="">Other</option></select></label>
          <label className="label label-caps">Service label (shown on cards)<input name="serviceName" className="admin-input" placeholder="Residential Interior Design" /></label>
          <label className="label label-caps">Starting stage<select name="stageId" className="admin-input" defaultValue={stages[0]?.id}>{phases.flatMap((p) => stages.filter((s) => s.phaseId === p.id).map((s) => <option key={s.id} value={s.id}>{p.name} · {s.name}</option>))}</select></label>
          <label className="label label-caps">Project lead<select name="ownerId" className="admin-input" defaultValue={user.id}>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="label label-caps">Contract value ($)<input name="contractValue" type="number" step="0.01" className="admin-input" /></label>
          <label className="label label-caps">Signed on<input name="signedAt" type="date" className="admin-input" /></label>
          <label className="label label-caps">Target completion<input name="targetDate" type="date" className="admin-input" /></label>
          <label className="label label-caps">Next milestone<input name="nextMilestone" className="admin-input" /></label>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Site address<input name="address" className="admin-input" /></label>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Scope<textarea name="scope" rows={3} className="admin-input" /></label>
          <button type="submit" className="btn btn-navy" style={{ gridColumn: "1/-1", justifySelf: "start" }}>Create project</button>
        </form>
      </Card>
    </AdminShell>
  );
}
