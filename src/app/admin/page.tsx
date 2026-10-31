import Link from "next/link";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, leads, bookings, projects, projectStages, projectPhases, posts, pages, products, socialPosts, outbox, cronRuns, ccResources, ccEvents, paths } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, Avatar } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import { money, fmtDateTime, relativeDay } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";
const TZ = "America/New_York";

export default async function DashboardPage() {
  const user = await requireArea("dashboard");
  const now = new Date();
  const d = (n: number) => new Date(now.getTime() - n * 864e5);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const weekAhead = new Date(now.getTime() + 7 * 864e5);
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  const [[l7], [l14], [consultsWeek], [proposals], [won], bySource, upcoming, stageCounts, phases, stages, [drafts], [edited], [rss], [featured], [allProducts], [scheduled], [queue], [failedOutbox], lastCron, [pendingCc], pathRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(leads).where(gte(leads.createdAt, d(7))),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(gte(leads.createdAt, d(14)), lt(leads.createdAt, d(7)))),
    db.select({ n: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.status, "booked"), gte(bookings.startsAt, now), lt(bookings.startsAt, weekAhead))),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.stage, "proposal_sent"), eq(leads.archived, false))),
    db.select({ n: sql<number>`count(*)`, v: sql<number>`coalesce(sum(${projects.contractValue}),0)` }).from(projects).where(gte(projects.createdAt, quarterStart)),
    db.select({ label: leads.sourceLabel, n: sql<number>`count(*)` }).from(leads).where(gte(leads.createdAt, d(30))).groupBy(leads.sourceLabel).orderBy(desc(sql`count(*)`)),
    db.select({ b: bookings, lead: leads }).from(bookings).innerJoin(leads, eq(leads.id, bookings.leadId)).where(and(eq(bookings.status, "booked"), gte(bookings.startsAt, new Date(now.getTime() - 3600000)))).orderBy(asc(bookings.startsAt)).limit(6),
    db.select({ stageId: projects.stageId, n: sql<number>`count(*)` }).from(projects).where(eq(projects.status, "active")).groupBy(projects.stageId),
    db.select().from(projectPhases).orderBy(asc(projectPhases.sort)),
    db.select().from(projectStages),
    db.select({ n: sql<number>`count(*)` }).from(posts).where(eq(posts.status, "draft")),
    db.select({ n: sql<number>`count(*)` }).from(pages).where(gte(pages.updatedAt, d(7))),
    db.select({ n: sql<number>`count(*)` }).from(posts).where(and(eq(posts.origin, "rss"), gte(posts.createdAt, d(7)))),
    db.select({ n: sql<number>`count(*)` }).from(products).where(and(eq(products.featured, true), eq(products.isActive, true))),
    db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.isActive, true)),
    db.select({ n: sql<number>`count(*)` }).from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), gte(socialPosts.scheduledAt, now), lt(socialPosts.scheduledAt, weekAhead))),
    db.select({ n: sql<number>`count(*)` }).from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), sql`${socialPosts.originPostId} is not null`)),
    db.select({ n: sql<number>`count(*)` }).from(outbox).where(eq(outbox.status, "failed")),
    db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(1),
    db.select({ n: sql<number>`(select count(*) from ${ccResources} where ${ccResources.status} = 'pending') + (select count(*) from ${ccEvents} where ${ccEvents.status} = 'pending')` }).from(sql`(select 1) as one`),
    db.select({ id: paths.id, label: paths.label, short: paths.short }).from(paths),
  ]);
  const tw = Number(l7.n), lw = Number(l14.n);
  const maxSource = Math.max(1, ...bySource.map((s) => Number(s.n)));
  const stageMap = new Map(stages.map((s) => [s.id, s.phaseId]));
  const perPhase = phases.map((p) => ({ name: p.name, color: p.color, n: stageCounts.filter((c) => c.stageId && stageMap.get(c.stageId) === p.id).reduce((a, c) => a + Number(c.n), 0) }));
  const metrics = await db.select({ metrics: socialPosts.metrics }).from(socialPosts).where(and(eq(socialPosts.status, "published"), gte(socialPosts.publishedAt, d(7))));
  const eng = metrics.reduce((a, m) => a + Object.values(m.metrics || {}).reduce((x, y) => x + (y.engagements || 0), 0), 0);
  const greeting = (() => { const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now)); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();
  return (
    <AdminShell user={user} active="dash" title={`${greeting}, ${user.name.split(" ")[0]}`} subtitle={new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(now)} actions={<Link href="/admin/leads/new" className="btn btn-navy btn-sm" style={{ height: 40, borderRadius: 10 }}>+ Add lead</Link>}>
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="New leads · 7 days" value={tw} delta={lw ? `${tw >= lw ? "+" : ""}${Math.round(((tw - lw) / lw) * 100)}% vs last week` : `${tw} this week`} deltaColor={tw >= lw ? "#1f6b3f" : "#9a3c1e"} />
        <Stat label="Consultations · next 7 days" value={Number(consultsWeek.n)} delta="booked on the calendar" />
        <Stat label="Proposals out" value={Number(proposals.n)} delta="awaiting signature" />
        <Stat label="Won this quarter" value={money(Number(won.v))} delta={`${Number(won.n)} project${Number(won.n) === 1 ? "" : "s"} signed`} deltaColor="#1f6b3f" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Leads by source page" sub="Last 30 days · where consultations come from" action={<Link href="/admin/leads" className="link-btn">All leads →</Link>}>
          {bySource.length ? bySource.map((s) => (
            <div key={s.label || "?"} style={{ display: "grid", gridTemplateColumns: "190px 1fr 36px", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label || "Unknown"}</span>
              <span style={{ height: 10, borderRadius: 999, background: "#eef0f4", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.round((Number(s.n) / maxSource) * 100)}%`, background: "linear-gradient(90deg,#6cb6e6,#3f9ad9)", borderRadius: 999 }} /></span>
              <b style={{ textAlign: "right" }}>{Number(s.n)}</b>
            </div>)) : <span style={{ fontSize: 13, color: "#8c95a8" }}>No leads in the last 30 days.</span>}
        </Card>
        <Card title="Upcoming consultations" sub="Next on the calendar" action={<Link href="/admin/calendar" className="link-btn">Open calendar →</Link>}>
          {upcoming.length ? upcoming.map(({ b, lead }) => { const isToday = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(b.startsAt) === todayYmd; return (
            <Link key={b.id} href={`/admin/leads?open=${lead.id}`} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#1a2238" }}>
              <span style={{ width: 64, flex: "none", fontSize: 12, fontWeight: 700, color: isToday ? "#e0532f" : "#6b7486" }}>{isToday ? "Today" : relativeDay(b.startsAt)}</span>
              <Avatar name={lead.name} size={28} />
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600 }}>{lead.name}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{fmtDateTime(b.startsAt)} · {pathRows.find((p) => p.id === lead.pathId)?.short || lead.sourceLabel}</span></span>
            </Link>); }) : <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing booked yet.</span>}
        </Card>
      </div>
      <div className="g3" style={{ gap: 20, alignItems: "start" }}>
        <Card title="Pipeline" sub="Active projects by phase" action={<Link href="/admin/projects" className="link-btn">Open pipeline →</Link>}>
          {perPhase.map((p) => <div key={p.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />{p.name}</span><b>{p.n}</b></div>)}
        </Card>
        <Card title="Content" action={<Link href="/admin/content" className="link-btn">Open CMS →</Link>}>
          {([["Draft posts", Number(drafts.n)], ["Pages edited this week", Number(edited.n)], ["RSS items imported (7d)", Number(rss.n)], ["Products featured", `${Number(featured.n)} / ${Number(allProducts.n)}`], ["Caribbean items awaiting review", Number(pendingCc.n)]] as [string, string | number][]).map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{l}</span><b>{v}</b></div>)}
        </Card>
        <Card title="Social & delivery" action={<Link href="/admin/social" className="link-btn">Open social →</Link>}>
          {([["Scheduled this week", Number(scheduled.n)], ["Engagement (7d)", eng ? `${eng}` : "—"], ["Auto-share queue", `${Number(queue.n)} post${Number(queue.n) === 1 ? "" : "s"}`], ["Failed emails / texts", Number(failedOutbox.n)], ["Last scheduled job", lastCron[0] ? `${lastCron[0].job} · ${relativeDay(lastCron[0].startedAt)}` : "never"]] as [string, string | number][]).map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{l}</span><b style={{ color: l.startsWith("Failed") && Number(v) > 0 ? "#9a3c1e" : undefined }}>{v}</b></div>)}
          <Link href="/admin/ops" className="link-btn" style={{ fontSize: 12 }}>Outbox, cron & integrations →</Link>
        </Card>
      </div>
    </AdminShell>
  );
}
