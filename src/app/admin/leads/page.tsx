import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, leads, leadActivity, bookings, documents, users, paths, projects, LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Stat } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import LeadsView from "@/components/admin/LeadsView";
import LeadDrawer from "@/components/admin/LeadDrawer";
import { money } from "@/lib/utils";
import { env } from "@/lib/env";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireArea("leads");
  const sp = await searchParams;
  const source = one(sp.source) || "All";
  const view = one(sp.view) === "board" ? "board" : "table";
  const archived = one(sp.archived) === "1";
  const q = one(sp.q);
  const openId = Number(one(sp.open)) || 0;

  const where = [eq(leads.archived, archived)];
  if (source !== "All") where.push(or(eq(leads.sourceLabel, source), eq(leads.sourcePage, source))!);
  if (q) where.push(or(ilike(leads.name, `%${q}%`), ilike(leads.email, `%${q}%`), ilike(leads.phone, `%${q}%`))!);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 864e5);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const [rows, team, pathRows, sourceRows, [thisWeek], [lastWeek], [upcoming], [proposals], [won]] = await Promise.all([
    db.select({ lead: leads, owner: users.name }).from(leads).leftJoin(users, eq(users.id, leads.ownerId)).where(and(...where)).orderBy(desc(leads.createdAt)).limit(500),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
    db.select({ id: paths.id, label: paths.label }).from(paths).orderBy(asc(paths.sort)),
    db.selectDistinct({ label: leads.sourceLabel }).from(leads).where(eq(leads.archived, false)),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(gte(leads.createdAt, weekAgo)),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(gte(leads.createdAt, twoWeeksAgo), lt(leads.createdAt, weekAgo))),
    db.select({ n: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.status, "booked"), gte(bookings.startsAt, now))),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.stage, "proposal_sent"), eq(leads.archived, false))),
    db.select({ n: sql<number>`coalesce(sum(${projects.contractValue}),0)`, c: sql<number>`count(*)` }).from(projects).where(gte(projects.createdAt, quarterStart)),
  ]);

  const sources = ["All", ...sourceRows.map((s) => s.label).filter((s): s is string => !!s).sort()];
  const tw = Number(thisWeek.n), lw = Number(lastWeek.n);
  const delta = lw === 0 ? (tw ? "+100% vs last week" : "no change") : `${tw >= lw ? "+" : ""}${Math.round(((tw - lw) / lw) * 100)}% vs last week`;

  const tableRows = rows.map(({ lead, owner }) => ({ id: lead.id, name: lead.name, email: lead.email || "", phone: lead.phone || "", source: lead.sourceLabel || lead.sourcePage, stage: lead.stage, owner: owner || "Unassigned", createdAt: lead.createdAt.toISOString(), followUpAt: lead.followUpAt, tags: lead.tags, converted: !!lead.convertedProjectId }));
  const stages = LEAD_STAGES.map((s) => ({ id: s as LeadStage, label: LEAD_STAGE_LABELS[s] }));

  let drawer: React.ReactNode = null;
  if (openId) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, openId)).limit(1);
    if (lead) {
      const [acts, bks, docs, proj] = await Promise.all([
        db.select({ a: leadActivity, userName: users.name }).from(leadActivity).leftJoin(users, eq(users.id, leadActivity.userId)).where(eq(leadActivity.leadId, lead.id)).orderBy(desc(leadActivity.createdAt)).limit(100),
        db.select().from(bookings).where(eq(bookings.leadId, lead.id)).orderBy(desc(bookings.startsAt)),
        db.select({ id: documents.id, name: documents.name, url: documents.url, type: documents.type }).from(documents).where(eq(documents.leadId, lead.id)).orderBy(desc(documents.createdAt)),
        lead.convertedProjectId ? db.select({ id: projects.id, code: projects.code, name: projects.name }).from(projects).where(eq(projects.id, lead.convertedProjectId)).limit(1) : Promise.resolve([]),
      ]);
      drawer = (
        <LeadDrawer
          lead={{ ...lead, createdAt: lead.createdAt.toISOString(), consentAt: lead.consentAt ? lead.consentAt.toISOString() : null } as any}
          activity={acts.map(({ a, userName }) => ({ id: a.id, type: a.type, body: a.body, attachmentUrl: a.attachmentUrl, createdAt: a.createdAt.toISOString(), userName }))}
          bookings={bks.map((b) => ({ id: b.id, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), status: b.status }))}
          documents={docs}
          team={team}
          paths={pathRows}
          project={proj[0] || null}
          canDelete={user.role === "owner" || user.isSuperAdmin}
          cftUrl={env.cft.url ? `/api/cft/launch?target=${encodeURIComponent(lead.externalSource === "cft" ? "/crm" : "/calls")}` : null}
        />
      );
    }
  }

  return (
    <AdminShell user={user} active="leads" title="Leads" subtitle="Every form submission, tagged with the page it came from" actions={<Link href="/admin/leads/new" className="btn btn-navy btn-sm" style={{ height: 40, borderRadius: 10 }}>+ Add lead</Link>}>
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="New leads · 7 days" value={tw} delta={delta} deltaColor={tw >= lw ? "#1f6b3f" : "#9a3c1e"} />
        <Stat label="Consultations upcoming" value={Number(upcoming.n)} delta="booked on the calendar" />
        <Stat label="Proposals out" value={Number(proposals.n)} delta="awaiting signature" />
        <Stat label="Won this quarter" value={money(Number(won.n))} delta={`${Number(won.c)} project${Number(won.c) === 1 ? "" : "s"} signed`} deltaColor="#1f6b3f" />
      </div>
      <LeadsView rows={tableRows} sources={sources} currentSource={source} view={view} stages={stages} archived={archived} q={q} />
      {drawer}
    </AdminShell>
  );
}
