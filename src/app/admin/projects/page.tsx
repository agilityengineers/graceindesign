import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, projects, projectPhases, projectStages, projectFields, invoices, milestones, documents, approvals, projectActivity, portalAccess, users, leads } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import { env } from "@/lib/env";
import AdminShell from "@/components/admin/AdminShell";
import { Stat } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ProjectsView, { type ProjectRow, type StageCol } from "@/components/admin/ProjectsView";
import ProjectDrawer from "@/components/admin/ProjectDrawer";
import PipelineConfig from "@/components/admin/PipelineConfig";
import { money } from "@/lib/utils";

export const metadata = { title: "Project Pipeline" };
export const dynamic = "force-dynamic";
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireArea("projects");
  const sp = await searchParams;
  const view = one(sp.view) === "table" ? "table" : one(sp.view) === "config" ? "config" : "board";
  const filter = one(sp.filter) || "Active";
  const openId = Number(one(sp.open)) || 0;

  const [phases, stageRows, team] = await Promise.all([
    db.select().from(projectPhases).orderBy(asc(projectPhases.sort)),
    db.select().from(projectStages).orderBy(asc(projectStages.sort)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
  ]);
  const phaseById = new Map(phases.map((p) => [p.id, p]));
  const stageCols: StageCol[] = phases.flatMap((p) => stageRows.filter((s) => s.phaseId === p.id).map((s) => ({ id: s.id, name: s.name, phase: p.name, color: p.color })));

  if (view === "config") {
    const [counts, fields, rules] = await Promise.all([
      db.select({ stageId: projects.stageId, n: sql<number>`count(*)` }).from(projects).groupBy(projects.stageId),
      db.select().from(projectFields).orderBy(asc(projectFields.sort)),
      getSetting("conversion_rules"),
    ]);
    const countBy = new Map(counts.map((c) => [c.stageId, Number(c.n)]));
    return (
      <AdminShell user={user} active="projects" title="Configure pipeline" subtitle="Phases, stages, automation, project fields and conversion rules">
        <Toast />
        <PipelineConfig phases={phases.map((p) => ({ id: p.id, name: p.name, color: p.color, stages: stageRows.filter((s) => s.phaseId === p.id).map((s) => ({ id: s.id, name: s.name, automation: s.automation, count: countBy.get(s.id) || 0 })) }))} fields={fields} rules={rules} />
      </AdminShell>
    );
  }

  const statusWhere = filter === "All" ? undefined : filter === "Closed" ? eq(projects.status, "closed") : filter === "Archived" ? eq(projects.status, "archived") : eq(projects.status, "active");
  const rows = await db.select({ p: projects, owner: users.name }).from(projects).leftJoin(users, eq(users.id, projects.ownerId)).where(statusWhere).orderBy(desc(projects.createdAt)).limit(500);
  const ids = rows.map((r) => r.p.id);
  const paid = ids.length ? await db.select({ projectId: invoices.projectId, sum: sql<number>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(inArray(invoices.projectId, ids), eq(invoices.status, "paid"))).groupBy(invoices.projectId) : [];
  const paidBy = new Map(paid.map((x) => [x.projectId, Number(x.sum)]));
  const stageById = new Map(stageRows.map((s) => [s.id, s]));
  const tableRows: ProjectRow[] = rows.map(({ p, owner }) => { const st = p.stageId ? stageById.get(p.stageId) : null; const ph = st ? phaseById.get(st.phaseId) : null; return { id: p.id, code: p.code, name: p.name, service: p.serviceName || "—", stageId: p.stageId, stage: st?.name || "Unstaged", phase: ph?.name || "", value: Number(p.contractValue || 0), billed: paidBy.get(p.id) || 0, owner: owner || "Unassigned", signedAt: p.signedAt, targetDate: p.targetDate, nextMilestone: p.nextMilestone, status: p.status }; });

  const quarterStart = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1);
  const [[active], [outstanding], [signedQ], [dueSoon]] = await Promise.all([
    db.select({ n: sql<number>`count(*)`, v: sql<number>`coalesce(sum(${projects.contractValue}),0)` }).from(projects).where(eq(projects.status, "active")),
    db.select({ v: sql<number>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).innerJoin(projects, eq(projects.id, invoices.projectId)).where(and(eq(projects.status, "active"), ne(invoices.status, "paid"), ne(invoices.status, "void"))),
    db.select({ n: sql<number>`count(*)`, v: sql<number>`coalesce(sum(${projects.contractValue}),0)` }).from(projects).where(sql`${projects.signedAt} >= ${quarterStart.toISOString().slice(0, 10)}`),
    db.select({ n: sql<number>`count(*)` }).from(milestones).innerJoin(projects, eq(projects.id, milestones.projectId)).where(and(eq(projects.status, "active"), sql`${milestones.doneAt} is null`, sql`${milestones.dueAt} <= current_date + 14`)),
  ]);

  let drawer: React.ReactNode = null;
  if (openId) {
    const [row] = await db.select({ p: projects, leadEmail: leads.email }).from(projects).leftJoin(leads, eq(leads.id, projects.leadId)).where(eq(projects.id, openId)).limit(1);
    if (row) {
      const p = row.p;
      const [inv, ms, docs, aps, acts, portal] = await Promise.all([
        db.select().from(invoices).where(eq(invoices.projectId, p.id)).orderBy(asc(invoices.sort), asc(invoices.id)),
        db.select().from(milestones).where(eq(milestones.projectId, p.id)).orderBy(asc(milestones.sort), asc(milestones.id)),
        db.select().from(documents).where(eq(documents.projectId, p.id)).orderBy(desc(documents.createdAt)),
        db.select().from(approvals).where(eq(approvals.projectId, p.id)).orderBy(desc(approvals.requestedAt)),
        db.select({ a: projectActivity, userName: users.name }).from(projectActivity).leftJoin(users, eq(users.id, projectActivity.userId)).where(eq(projectActivity.projectId, p.id)).orderBy(desc(projectActivity.createdAt)).limit(100),
        db.query.portalAccess.findFirst({ where: eq(portalAccess.projectId, p.id) }),
      ]);
      drawer = (
        <ProjectDrawer
          project={{ id: p.id, code: p.code, name: p.name, leadId: p.leadId, leadName: p.leadName, leadEmail: row.leadEmail, serviceName: p.serviceName, stageId: p.stageId, ownerId: p.ownerId, contractValue: Number(p.contractValue || 0), signedAt: p.signedAt, targetDate: p.targetDate, address: p.address, scope: p.scope, nextMilestone: p.nextMilestone, status: p.status, notes: p.notes, depositPct: p.depositPct, clientPortalEnabled: p.clientPortalEnabled, answers: p.answers }}
          invoices={inv.map((i) => ({ id: i.id, label: i.label, amount: Number(i.amount), status: i.status, dueAt: i.dueAt, paidAt: iso(i.paidAt), stripeHostedUrl: i.stripeHostedUrl }))}
          milestones={ms.map((m) => ({ id: m.id, title: m.title, dueAt: m.dueAt, doneAt: iso(m.doneAt), visibleToClient: m.visibleToClient }))}
          documents={docs.map((d) => ({ id: d.id, name: d.name, url: d.url, type: d.type, visibleToClient: d.visibleToClient }))}
          approvals={aps.map((a) => ({ id: a.id, title: a.title, status: a.status, requestedAt: a.requestedAt.toISOString(), respondedAt: iso(a.respondedAt), responseNote: a.responseNote }))}
          activity={acts.map(({ a, userName }) => ({ id: a.id, type: a.type, body: a.body, createdAt: a.createdAt.toISOString(), userName }))}
          team={team} stages={stageCols.map((s) => ({ id: s.id, name: s.name, phase: s.phase }))} portalToken={portal?.token || null} canDelete={user.role === "owner" || user.isSuperAdmin} baseUrl={env.baseUrl}
        />
      );
    }
  }

  return (
    <AdminShell user={user} active="projects" title="Project Pipeline" subtitle="Signed work, from agreement to closed">
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="Active projects" value={Number(active.n)} delta={`${money(Number(active.v))} under contract`} />
        <Stat label="Outstanding invoices" value={money(Number(outstanding.v))} delta="unpaid on active projects" deltaColor={Number(outstanding.v) ? "#9a3c1e" : "#1f6b3f"} />
        <Stat label="Signed this quarter" value={money(Number(signedQ.v))} delta={`${Number(signedQ.n)} agreement${Number(signedQ.n) === 1 ? "" : "s"}`} deltaColor="#1f6b3f" />
        <Stat label="Milestones due · 14 days" value={Number(dueSoon.n)} delta="open on active projects" />
      </div>
      <ProjectsView rows={tableRows} stages={stageCols} view={view} filter={filter} />
      {drawer}
    </AdminShell>
  );
}
