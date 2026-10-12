"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Close } from "@/components/ui/Icons";
import { Avatar, StatusPill } from "./ui";
import ConfirmButton from "./Confirm";
import { updateProject, deleteProject, addProjectNote, addInvoice, invoiceAction, addMilestone, milestoneAction, attachProjectDocument, documentAction, requestApproval, approvalAction, portalAction } from "@/lib/actions/projects";
import { money, fmtDate, fmtDateTime, relativeDay } from "@/lib/utils";

export type DrawerProject = { id: number; code: string; name: string; leadId: number | null; leadName: string | null; leadEmail: string | null; serviceName: string | null; stageId: number | null; ownerId: number | null; contractValue: number; signedAt: string | null; targetDate: string | null; address: string | null; scope: string | null; nextMilestone: string | null; status: string; notes: string | null; depositPct: number; clientPortalEnabled: boolean; answers: Record<string, unknown> };
type Invoice = { id: number; label: string; amount: number; status: string; dueAt: string | null; paidAt: string | null; stripeHostedUrl: string | null };
type Milestone = { id: number; title: string; dueAt: string | null; doneAt: string | null; visibleToClient: boolean };
type Doc = { id: number; name: string; url: string; type: string; visibleToClient: boolean };
type Approval = { id: number; title: string; status: string; requestedAt: string; respondedAt: string | null; responseNote: string | null };
type Activity = { id: number; type: string; body: string; createdAt: string; userName: string | null };
type StageOpt = { id: number; name: string; phase: string };

const ICON: Record<string, [string, string]> = { note: ["✎", "#f2f4f7"], stage: ["●", "#e6f3fc"], system: ["●", "#f2f4f7"], automation: ["⚡", "#fff4d6"], invoice: ["$", "#dcefe4"], payment: ["$", "#dcefe4"], milestone: ["✓", "#dcefe4"], document: ["▲", "#e9e4fb"], approval: ["?", "#fff4d6"], portal: ["⇄", "#e6f3fc"], proposal: ["▲", "#dcefe4"] };

export default function ProjectDrawer({ project, invoices, milestones, documents, approvals, activity, team, stages, portalToken, canDelete, baseUrl }: { project: DrawerProject; invoices: Invoice[]; milestones: Milestone[]; documents: Doc[]; approvals: Approval[]; activity: Activity[]; team: { id: number; name: string }[]; stages: StageOpt[]; portalToken: string | null; canDelete: boolean; baseUrl: string }) {
  const router = useRouter(); const sp = useSearchParams();
  const back = `/admin/projects?${(() => { const n = new URLSearchParams(sp.toString()); n.set("open", String(project.id)); n.delete("ok"); n.delete("err"); return n.toString(); })()}`;
  const close = () => { const n = new URLSearchParams(sp.toString()); n.delete("open"); n.delete("ok"); n.delete("err"); router.push(`/admin/projects${n.toString() ? `?${n}` : ""}`); };
  const [panel, setPanel] = useState<"invoice" | "milestone" | "document" | "approval" | null>(null);
  const billed = invoices.filter((i) => i.status === "paid").reduce((a, b) => a + b.amount, 0);
  const outstanding = invoices.filter((i) => i.status !== "paid" && i.status !== "void").reduce((a, b) => a + b.amount, 0);
  const hidden = <><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="_back" value={back} /></>;
  const Section = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ padding: "18px 28px", borderBottom: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 10 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span className="label-caps">{title}</span>{action}</div>{children}</div>
  );
  const Mini = ({ op, label, invoiceId, confirm, danger }: { op: string; label: string; invoiceId: number; confirm?: string; danger?: boolean }) => (
    <form action={invoiceAction} style={{ display: "inline" }}>{hidden}<input type="hidden" name="invoiceId" value={invoiceId} /><input type="hidden" name="op" value={op} />{confirm ? <ConfirmButton message={confirm} className={`link-btn ${danger ? "link-danger" : ""}`}>{label}</ConfirmButton> : <button type="submit" className="link-btn">{label}</button>}</form>
  );
  return (<>
    <div className="drawer-backdrop" onClick={close} />
    <aside className="drawer drawer-wide" aria-label={`Project: ${project.name}`}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 11, color: "#8c95a8", fontWeight: 600, letterSpacing: ".08em" }}>{project.code}</span><span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.25 }}>{project.name}</span><span style={{ fontSize: 13, color: "#6b7486" }}>{project.serviceName || "Project"}{project.signedAt ? ` · signed ${fmtDate(project.signedAt)}` : ""}{project.leadName ? <> · from lead {project.leadId ? <Link href={`/admin/leads?open=${project.leadId}`} style={{ color: "#3f9ad9" }}>“{project.leadName}”</Link> : `“${project.leadName}”`}</> : null}</span>{project.status !== "active" && <span><StatusPill status={project.status} /></span>}</div>
        <button type="button" onClick={close} aria-label="Close" style={{ width: 34, height: 34, borderRadius: "50%", background: "#f2f4f7", border: 0, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", cursor: "pointer" }}><Close /></button>
      </div>

      <form action={updateProject} style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, borderBottom: "1px solid #eef0f4" }}>
        <input type="hidden" name="id" value={project.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="portalForm" value="1" />
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Project name<input name="name" defaultValue={project.name} className="admin-input" /></label>
        <label className="label label-caps">Stage<select name="stageId" defaultValue={project.stageId ?? ""} className="admin-input">{stages.map((s) => <option key={s.id} value={s.id}>{s.phase} · {s.name}</option>)}</select></label>
        <label className="label label-caps">Project lead<select name="ownerId" defaultValue={project.ownerId ?? ""} className="admin-input">{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="">Unassigned</option></select></label>
        <label className="label label-caps">Contract value ($)<input name="contractValue" type="number" step="0.01" defaultValue={project.contractValue || ""} className="admin-input" /></label>
        <label className="label label-caps">Target completion<input name="targetDate" type="date" defaultValue={project.targetDate || ""} className="admin-input" /></label>
        <label className="label label-caps">Service<input name="serviceName" defaultValue={project.serviceName || ""} className="admin-input" /></label>
        <label className="label label-caps">Signed on<input name="signedAt" type="date" defaultValue={project.signedAt || ""} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Site address<input name="address" defaultValue={project.address || ""} className="admin-input" /></label>
        <label className="label label-caps">Next milestone<input name="nextMilestone" defaultValue={project.nextMilestone || ""} className="admin-input" /></label>
        <label className="label label-caps">Deposit %<input name="depositPct" type="number" min={0} max={100} defaultValue={project.depositPct} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Scope<textarea name="scope" rows={2} defaultValue={project.scope || ""} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Internal notes<textarea name="notes" rows={2} defaultValue={project.notes || ""} className="admin-input" /></label>
        <label className="label label-caps">Status<select name="status" defaultValue={project.status} className="admin-input"><option value="active">Active</option><option value="closed">Closed</option><option value="archived">Archived</option></select></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, alignSelf: "end", height: 40 }}><input type="checkbox" name="clientPortalEnabled" defaultChecked={project.clientPortalEnabled} />Client portal enabled</label>
        <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end" }}><button type="submit" className="btn btn-navy btn-sm">Save changes</button></div>
      </form>

      <Section title="Invoices & billing" action={<button type="button" className="link-btn" onClick={() => setPanel(panel === "invoice" ? null : "invoice")}>+ Invoice</button>}>
        {panel === "invoice" && (
          <form action={addInvoice} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>{hidden}
            <label className="label label-caps">Label<input name="label" placeholder="Progress (30%)" className="admin-input admin-input-sm" required /></label>
            <label className="label label-caps">Amount<input name="amount" type="number" step="0.01" className="admin-input admin-input-sm" required /></label>
            <label className="label label-caps">Due<input name="dueAt" type="date" className="admin-input admin-input-sm" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ height: 34 }}>Add</button>
          </form>)}
        {invoices.map((inv) => (
          <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr auto", gap: 10, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontWeight: 600 }}>{inv.label}</span><span style={{ fontSize: 11, color: "#8c95a8" }}>{inv.paidAt ? `Paid ${fmtDate(inv.paidAt)}` : inv.dueAt ? `Due ${fmtDate(inv.dueAt)}` : "No due date"}{inv.stripeHostedUrl && <> · <a href={inv.stripeHostedUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>Stripe</a></>}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontWeight: 600 }}>{money(inv.amount)}</span><StatusPill status={inv.status} /></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {inv.status === "pending" && <Mini op="send" label="Send" invoiceId={inv.id} />}
              {inv.status !== "paid" && inv.status !== "void" && <Mini op="paid" label="Mark paid" invoiceId={inv.id} />}
              {inv.status === "paid" && <Mini op="pending" label="Reopen" invoiceId={inv.id} />}
              {inv.status !== "void" && inv.status !== "paid" && <Mini op="void" label="Void" invoiceId={inv.id} confirm="Void this invoice?" />}
              {canDelete && <Mini op="delete" label="Delete" invoiceId={inv.id} confirm="Delete this invoice?" danger />}
            </div>
          </div>))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7486", paddingTop: 4 }}><span>Billed <strong style={{ color: "#1a2238" }}>{money(billed)}</strong> of {money(project.contractValue)}</span><span>Outstanding <strong style={{ color: outstanding ? "#9a3c1e" : "#1f6b3f" }}>{money(outstanding)}</strong></span></div>
      </Section>

      <Section title="Milestones & documents" action={<div style={{ display: "flex", gap: 12 }}><button type="button" className="link-btn" onClick={() => setPanel(panel === "milestone" ? null : "milestone")}>+ Milestone</button><button type="button" className="link-btn" onClick={() => setPanel(panel === "document" ? null : "document")}>Attach</button></div>}>
        {panel === "milestone" && (
          <form action={addMilestone} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>{hidden}
            <label className="label label-caps">Milestone<input name="title" className="admin-input admin-input-sm" required /></label>
            <label className="label label-caps">Due<input name="dueAt" type="date" className="admin-input admin-input-sm" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ height: 34 }}>Add</button>
          </form>)}
        {panel === "document" && (
          <form action={attachProjectDocument} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{hidden}
            <label className="label label-caps">Name<input name="name" className="admin-input admin-input-sm" placeholder="Signed agreement.pdf" /></label>
            <label className="label label-caps">Type<select name="type" className="admin-input admin-input-sm" defaultValue="other"><option value="agreement">Agreement</option><option value="proposal">Proposal</option><option value="invoice">Invoice</option><option value="photo">Photo</option><option value="other">Other</option></select></label>
            <label className="label label-caps">File<input name="file" type="file" className="admin-input admin-input-sm" style={{ paddingTop: 6 }} /></label>
            <label className="label label-caps">…or link<input name="url" placeholder="https://" className="admin-input admin-input-sm" /></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="visibleToClient" defaultChecked />Visible in client portal</label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ height: 34, justifySelf: "end" }}>Attach</button>
          </form>)}
        {milestones.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <form action={milestoneAction}>{hidden}<input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" aria-label={m.doneAt ? "Mark not done" : "Mark done"} style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${m.doneAt ? "#1f6b3f" : "#c6cbd6"}`, background: m.doneAt ? "#1f6b3f" : "#fff", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.doneAt ? "✓" : ""}</button></form>
            <span style={{ flex: 1, textDecoration: m.doneAt ? "line-through" : "none", color: m.doneAt ? "#6b7486" : "#1a2238" }}>{m.title}</span>
            <span style={{ fontSize: 11, color: "#8c95a8" }}>{m.doneAt ? fmtDate(m.doneAt) : m.dueAt ? relativeDay(m.dueAt) : ""}</span>
            <form action={milestoneAction}>{hidden}<input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="op" value="visibility" /><button type="submit" className="link-btn link-muted" title="Toggle client visibility">{m.visibleToClient ? "client" : "internal"}</button></form>
            <form action={milestoneAction}>{hidden}<input type="hidden" name="milestoneId" value={m.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this milestone?" className="link-btn link-danger">×</ConfirmButton></form>
          </div>))}
        {documents.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>{documents.map((d) => (
          <span key={d.id} className="tag" style={{ padding: "6px 10px", borderRadius: 8, gap: 8 }}><a href={d.url} target="_blank" rel="noreferrer" style={{ color: "#1a2238" }}>{d.name}</a>
            <form action={documentAction} style={{ display: "inline" }}>{hidden}<input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="op" value="visibility" /><button type="submit" className="link-btn link-muted" title="Toggle client visibility" style={{ fontSize: 10 }}>{d.visibleToClient ? "client" : "internal"}</button></form>
            <form action={documentAction} style={{ display: "inline" }}>{hidden}<input type="hidden" name="documentId" value={d.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove ${d.name}?`} className="link-btn link-danger" style={{ fontSize: 11 }}>×</ConfirmButton></form></span>))}</div>}
      </Section>

      <Section title="Client approvals & portal" action={<button type="button" className="link-btn" onClick={() => setPanel(panel === "approval" ? null : "approval")}>+ Request approval</button>}>
        {panel === "approval" && (
          <form action={requestApproval} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>{hidden}
            <input name="title" placeholder="Approve: concept boards" className="admin-input admin-input-sm" required />
            <textarea name="description" rows={2} placeholder="What should the client review?" className="admin-input" />
            <button type="submit" className="btn btn-navy btn-xs" style={{ height: 34, justifySelf: "end" }}>Send request</button>
          </form>)}
        {approvals.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ flex: 1 }}>{a.title}<span style={{ fontSize: 11, color: "#8c95a8", marginLeft: 8 }}>{a.respondedAt ? `${fmtDate(a.respondedAt)} · ${a.responseNote || ""}` : `requested ${relativeDay(a.requestedAt)}`}</span></span>
            <StatusPill status={a.status} />
            {a.status === "pending" ? <form action={approvalAction}>{hidden}<input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="approve" /><button type="submit" className="link-btn" title="Record approval received offline">Record approved</button></form> : <form action={approvalAction}>{hidden}<input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="reopen" /><button type="submit" className="link-btn link-muted">Reopen</button></form>}
            <form action={approvalAction}>{hidden}<input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this approval request?" className="link-btn link-danger">×</ConfirmButton></form>
          </div>))}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#6b7486", flexWrap: "wrap", padding: "8px 10px", borderRadius: 8, background: "#f7f9fc" }}>
          <span>{portalToken ? <>Portal link: <a href={`${baseUrl}/portal/${portalToken}`} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9", wordBreak: "break-all" }}>{baseUrl}/portal/{portalToken}</a></> : "No portal link issued yet."}</span>
          <form action={portalAction} style={{ display: "flex", gap: 8, alignItems: "center" }}>{hidden}<input name="email" placeholder={project.leadEmail || "client@email.com"} defaultValue={project.leadEmail || ""} className="admin-input admin-input-sm" style={{ width: 180 }} /><button type="submit" name="op" value="send" className="link-btn">Send link</button><button type="submit" name="op" value="regenerate" className="link-btn link-muted">Regenerate</button>{portalToken && <ConfirmButton name="op" value="revoke" message="Revoke the client's portal link?" className="link-btn link-danger">Revoke</ConfirmButton>}</form>
        </div>
      </Section>

      {Object.keys(project.answers || {}).length > 0 && (
        <Section title="Lead form answers">{Object.entries(project.answers).filter(([k]) => !["consent", "__hp", "cft"].includes(k)).map(([q, a]) => <div key={q} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, fontSize: 13 }}><span style={{ color: "#6b7486" }}>{q.replace(/_/g, " ")}</span><span style={{ fontWeight: 500, wordBreak: "break-word" }}>{Array.isArray(a) ? (a as string[]).join(", ") : String(a)}</span></div>)}</Section>
      )}

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <span className="label-caps">Activity</span>
        <form action={addProjectNote} style={{ display: "flex", gap: 8 }}><input type="hidden" name="id" value={project.id} /><input type="hidden" name="_back" value={back} /><input name="body" placeholder="Add a note…" className="admin-input" required /><button type="submit" className="btn btn-navy btn-sm" style={{ borderRadius: 999 }}>Save</button></form>
        {activity.map((ev) => { const [icon, bg] = ICON[ev.type] || ICON.system; return (
          <div key={ev.id} style={{ display: "flex", gap: 12 }}><span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{icon}</span><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 13, lineHeight: 1.45 }}>{ev.body}</span><span style={{ fontSize: 11, color: "#8c95a8" }}>{relativeDay(ev.createdAt)} · {fmtDateTime(ev.createdAt)}{ev.userName ? ` · ${ev.userName}` : ""}</span></div></div>); })}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #eef0f4", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#8c95a8", display: "flex", alignItems: "center", gap: 6 }}><Avatar name={team.find((t) => t.id === project.ownerId)?.name || "Unassigned"} size={20} dark />Project lead</span>
          {canDelete && <form action={deleteProject}><input type="hidden" name="id" value={project.id} /><ConfirmButton message="Permanently delete this project, its invoices, milestones and documents? This cannot be undone.">Delete project</ConfirmButton></form>}
        </div>
      </div>
    </aside>
  </>);
}
