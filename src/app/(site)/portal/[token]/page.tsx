import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import SiteFrame from "@/components/site/SiteFrame";
import { db, portalAccess, projects, projectStages, projectPhases, milestones, documents, invoices, approvals, projectActivity, users } from "@/lib/db";
import { emitEvent } from "@/lib/server/webhooks";
import { sendEmail } from "@/lib/server/outbox";
import { env } from "@/lib/env";
import { money, fmtDate, relativeDay } from "@/lib/utils";
import { Check } from "@/components/ui/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client portal", robots: { index: false, follow: false } };

async function loadPortal(token: string) {
  const access = await db.query.portalAccess.findFirst({ where: eq(portalAccess.token, token) });
  if (!access || (access.expiresAt && access.expiresAt < new Date())) return null;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, access.projectId) });
  if (!project || !project.clientPortalEnabled) return null;
  return { access, project };
}

async function respond(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || ""); const id = Number(formData.get("approvalId")); const decision = String(formData.get("decision")); const note = String(formData.get("note") || "").trim().slice(0, 600);
  const ctx = await loadPortal(token); if (!ctx) return;
  const a = await db.query.approvals.findFirst({ where: and(eq(approvals.id, id), eq(approvals.projectId, ctx.project.id)) }); if (!a || a.status !== "pending") return;
  const status = decision === "approve" ? "approved" : "changes_requested";
  await db.update(approvals).set({ status, respondedAt: new Date(), responseNote: note || null }).where(eq(approvals.id, id));
  await db.insert(projectActivity).values({ projectId: ctx.project.id, type: "approval", body: `Client ${status === "approved" ? "approved" : "requested changes on"} “${a.title}”${note ? `: ${note}` : ""}` });
  const owner = ctx.project.ownerId ? await db.query.users.findFirst({ where: eq(users.id, ctx.project.ownerId) }) : null;
  await sendEmail({ to: owner?.email || env.adminNotifyEmail, subject: `${status === "approved" ? "Approved" : "Changes requested"}: ${a.title} — ${ctx.project.name}`, text: `${ctx.access.email} responded in the client portal.\n\n${a.title}: ${status}${note ? `\n\nNote: ${note}` : ""}\n\n${env.baseUrl}/admin/projects?open=${ctx.project.id}` });
  await emitEvent("project.stage_changed", { projectId: ctx.project.id, code: ctx.project.code, approval: a.title, status });
  redirect(`/portal/${token}?ok=1#approvals`);
}

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const ctx = await loadPortal(token); if (!ctx) notFound();
  const { access, project } = ctx;
  await db.update(portalAccess).set({ lastUsedAt: new Date() }).where(eq(portalAccess.id, access.id));
  const [stage, ms, docs, inv, aps, owner] = await Promise.all([
    project.stageId ? db.select({ s: projectStages, p: projectPhases }).from(projectStages).innerJoin(projectPhases, eq(projectPhases.id, projectStages.phaseId)).where(eq(projectStages.id, project.stageId)).then((r) => r[0]) : null,
    db.select().from(milestones).where(and(eq(milestones.projectId, project.id), eq(milestones.visibleToClient, true))).orderBy(asc(milestones.sort), asc(milestones.id)),
    db.select().from(documents).where(and(eq(documents.projectId, project.id), eq(documents.visibleToClient, true))).orderBy(desc(documents.createdAt)),
    db.select().from(invoices).where(eq(invoices.projectId, project.id)).orderBy(asc(invoices.sort)),
    db.select().from(approvals).where(eq(approvals.projectId, project.id)).orderBy(desc(approvals.requestedAt)),
    project.ownerId ? db.query.users.findFirst({ where: eq(users.id, project.ownerId) }) : null,
  ]);
  const done = ms.filter((m) => m.doneAt).length;
  const paid = inv.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.amount), 0);
  const open = inv.filter((i) => i.status !== "paid" && i.status !== "void");
  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => <section id={id} style={{ display: "flex", flexDirection: "column", gap: 16 }}><h2 className="h2" style={{ fontSize: 26 }}>{title}</h2>{children}</section>;
  return (
    <SiteFrame label="Client portal" active="none" sourceKey="general">
      <section className="gx" style={{ paddingTop: 72, paddingBottom: 48, display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="eyebrow">Client portal · {project.code}</span>
        <h1 className="h1" style={{ fontSize: 48 }}>{project.name}</h1>
        <p className="lede" style={{ maxWidth: 720 }}>{stage ? <>Currently in <strong>{stage.p.name} · {stage.s.name}</strong>.</> : null}{project.targetDate ? <> Target completion <strong>{fmtDate(project.targetDate, { month: "long", day: "numeric", year: "numeric" })}</strong>.</> : null}{project.nextMilestone ? <> Next up: {project.nextMilestone}.</> : null}</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, color: "#6b7486" }}><span>{done} of {ms.length} milestones complete</span><span>{money(paid)} paid{open.length ? ` · ${money(open.reduce((a, i) => a + Number(i.amount), 0))} outstanding` : ""}</span>{owner && <span>Your project lead: {owner.name}{owner.email ? ` · ${owner.email}` : ""}</span>}</div>
        {sp.ok && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#dcefe4", color: "#1f6b3f", fontSize: 14, fontWeight: 600, alignSelf: "flex-start" }}>Thank you — your response was sent to the team.</div>}
      </section>
      <div className="gx" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 48, paddingBottom: 104 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          <Section id="schedule" title="Schedule">
            <ol style={{ display: "flex", flexDirection: "column", gap: 12, listStyle: "none", padding: 0 }}>{ms.map((m) => <li key={m.id} style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 15 }}><span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", background: m.doneAt ? "#1a2238" : "#e6f3fc", color: m.doneAt ? "#fff" : "#1a2238", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.doneAt ? <Check size={14} color="#6cb6e6" /> : ""}</span><span style={{ flex: 1, color: m.doneAt ? "#6b7486" : "#1a2238" }}>{m.title}</span><span style={{ fontSize: 13, color: "#8c95a8" }}>{m.doneAt ? `done ${fmtDate(m.doneAt)}` : m.dueAt ? relativeDay(m.dueAt) : ""}</span></li>)}</ol>
            {!ms.length && <p style={{ color: "#6b7486" }}>Milestones will appear here as we plan the work.</p>}
          </Section>
          <Section id="approvals" title="Approvals">
            {aps.map((a) => (
              <div key={a.id} style={{ padding: 20, borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong style={{ fontSize: 16 }}>{a.title}</strong><span style={{ fontSize: 13, color: a.status === "approved" ? "#1f6b3f" : a.status === "changes_requested" ? "#9a3c1e" : "#7a5a00", fontWeight: 600 }}>{a.status === "pending" ? "Waiting for you" : a.status === "approved" ? "Approved" : "Changes requested"}</span></div>
                {a.description && <p style={{ fontSize: 14, color: "#4b5569", lineHeight: 1.6 }}>{a.description}</p>}
                {a.status === "pending" ? (
                  <form action={respond} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input type="hidden" name="token" value={token} /><input type="hidden" name="approvalId" value={a.id} />
                    <textarea name="note" rows={2} placeholder="Comments (optional)" className="input" style={{ height: "auto", padding: 10 }} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="submit" name="decision" value="approve" className="btn btn-navy">Approve</button><button type="submit" name="decision" value="changes" className="btn btn-ghost">Request changes</button></div>
                  </form>
                ) : a.responseNote && <p style={{ fontSize: 13, color: "#6b7486" }}>Your note: {a.responseNote}</p>}
              </div>))}
            {!aps.length && <p style={{ color: "#6b7486" }}>Nothing needs your approval right now.</p>}
          </Section>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          <Section id="documents" title="Documents">
            {docs.map((d) => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, border: "1px solid #e9ecf1", fontSize: 14, color: "#1a2238" }}><span>{d.name}</span><span style={{ fontSize: 12, color: "#8c95a8", textTransform: "capitalize" }}>{d.type}</span></a>)}
            {!docs.length && <p style={{ color: "#6b7486" }}>Shared documents will appear here.</p>}
          </Section>
          <Section id="invoices" title="Invoices">
            {inv.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid #e9ecf1", fontSize: 14 }}><span style={{ display: "flex", flexDirection: "column" }}><strong>{i.label}</strong><span style={{ fontSize: 12, color: "#8c95a8" }}>{i.status === "paid" ? `Paid ${i.paidAt ? fmtDate(i.paidAt) : ""}` : i.dueAt ? `Due ${fmtDate(i.dueAt)}` : i.status}</span></span><span style={{ display: "flex", gap: 12, alignItems: "center" }}><strong>{money(Number(i.amount))}</strong>{i.status !== "paid" && i.status !== "void" && i.stripeHostedUrl && <a href={i.stripeHostedUrl} className="btn btn-navy btn-sm" style={{ borderRadius: 999 }}>Pay</a>}</span></div>)}
            {!inv.length && <p style={{ color: "#6b7486" }}>No invoices yet.</p>}
          </Section>
          <div style={{ padding: 20, borderRadius: 16, background: "#1a2238", color: "#fff", fontSize: 14, lineHeight: 1.7 }}>Questions? Reply to any project email or call <strong>(770) 691-1600</strong>. This page is private to {access.email} — please don't share the link.</div>
        </div>
      </div>
    </SiteFrame>
  );
}
