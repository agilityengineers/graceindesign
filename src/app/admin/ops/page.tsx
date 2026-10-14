import Link from "next/link";
import { asc, desc, eq, ne, and, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, emailSequences, emailSequenceSteps, sequenceEnrollments, smsTemplates, proposals, leads, projects, invoices, approvals, webhookSubscriptions, webhookDeliveries, webhookEvents, outbox, cronRuns, hubspotSync, paths, LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/db";
import { GID_EVENTS } from "@/lib/server/webhooks";
import { JOBS } from "@/lib/server/cron";
import { env } from "@/lib/env";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import { smsRoute } from "@/lib/server/outbox";
import { saveSequence, sequenceAction, saveSequenceStep, deleteSequenceStep, reorderSteps, enrollmentAction, enrollMatchingLeads, saveSmsTemplate, smsTemplateAction, saveProposal, proposalAction, saveWebhook, webhookAction, deliveryAction, emitTestEvent, outboxAction, purgeOutbox, runCronJob, hubspotSyncNow } from "@/lib/actions/ops";
import { invoiceAction, approvalAction } from "@/lib/actions/projects";
import { money, fmtDateTime, relativeDay } from "@/lib/utils";

export const metadata = { title: "Client ops" };
export const dynamic = "force-dynamic";
const TABS = [["sequences", "Email & SMS drips"], ["sms", "SMS templates"], ["proposals", "Proposals & e-sign"], ["invoices", "Invoices"], ["approvals", "Approvals"], ["webhooks", "Webhooks & CFT"], ["outbox", "Outbox"], ["jobs", "Scheduled jobs & HubSpot"]] as const;

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
  const user = await requireArea("ops");
  const sp = await searchParams; const tab = (TABS.find((t) => t[0] === sp.tab)?.[0] || "sequences") as (typeof TABS)[number][0];
  const [[queued], [failedMail], [pendingInv], [pendingAppr], [openProps]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(outbox).where(eq(outbox.status, "queued")),
    db.select({ n: sql<number>`count(*)` }).from(outbox).where(eq(outbox.status, "failed")),
    db.select({ n: sql<number>`count(*)`, v: sql<number>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(ne(invoices.status, "paid"), ne(invoices.status, "void"))),
    db.select({ n: sql<number>`count(*)` }).from(approvals).where(eq(approvals.status, "pending")),
    db.select({ n: sql<number>`count(*)` }).from(proposals).where(sql`${proposals.status} in ('sent','viewed')`),
  ]);
  const leadOpts = await db.select({ id: leads.id, name: leads.name, email: leads.email, phone: leads.phone }).from(leads).where(eq(leads.archived, false)).orderBy(desc(leads.createdAt)).limit(200);
  const H = ({ children }: { children: React.ReactNode }) => <span className="label-caps">{children}</span>;

  return (
    <AdminShell user={user} active="ops" title="Client ops" subtitle="Follow-up automation, proposals, billing, client approvals, integrations and delivery logs">
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="Proposals awaiting signature" value={Number(openProps.n)} delta="sent or viewed" />
        <Stat label="Outstanding invoices" value={money(Number(pendingInv.v))} delta={`${Number(pendingInv.n)} open`} deltaColor={Number(pendingInv.n) ? "#9a3c1e" : "#1f6b3f"} />
        <Stat label="Client approvals pending" value={Number(pendingAppr.n)} delta="waiting on clients" />
        <Stat label="Outbox" value={`${Number(queued.n)} queued`} delta={`${Number(failedMail.n)} failed`} deltaColor={Number(failedMail.n) ? "#9a3c1e" : "#6b7486"} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{TABS.map(([k, l]) => <Link key={k} href={`/admin/ops?tab=${k}`} className={`pill${tab === k ? " is-on" : ""}`}>{l}</Link>)}</div>

      {tab === "sequences" && await (async () => {
        const [seqs, steps, enrolls, pathRows] = await Promise.all([db.select().from(emailSequences).orderBy(asc(emailSequences.id)), db.select().from(emailSequenceSteps).orderBy(asc(emailSequenceSteps.sort)), db.select({ e: sequenceEnrollments, lead: leads.name, seq: emailSequences.name }).from(sequenceEnrollments).innerJoin(leads, eq(leads.id, sequenceEnrollments.leadId)).innerJoin(emailSequences, eq(emailSequences.id, sequenceEnrollments.sequenceId)).orderBy(desc(sequenceEnrollments.createdAt)).limit(100), db.select({ id: paths.id, label: paths.label }).from(paths)]);
        return (<>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {seqs.map((s) => { const mine = steps.filter((x) => x.sequenceId === s.id); return (
                <Card key={s.id} title={s.name} sub={`Triggers when a lead enters “${s.triggerStage ? LEAD_STAGE_LABELS[s.triggerStage] : "any stage"}”${s.triggerPathId ? ` on the ${pathRows.find((p) => p.id === s.triggerPathId)?.label || s.triggerPathId} path` : ""} · ${enrolls.filter((e) => e.e.sequenceId === s.id && e.e.status === "active").length} active`} action={<div style={{ display: "flex", gap: 12, alignItems: "center" }}><form action={sequenceAction}><input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" className={`toggle${s.isActive ? " is-on" : ""}`} aria-label="Toggle" /></form><form action={sequenceAction}><input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${s.name}” and stop its enrollments?`}>Delete</ConfirmButton></form></div>}>
                  <form action={saveSequence} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                    <input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="isActive" value={s.isActive ? "on" : ""} />
                    <label className="label label-caps">Name<input name="name" defaultValue={s.name} className="admin-input admin-input-sm" /></label>
                    <label className="label label-caps">Trigger stage<select name="triggerStage" defaultValue={s.triggerStage || ""} className="admin-input admin-input-sm"><option value="">Any</option>{LEAD_STAGES.map((st) => <option key={st} value={st}>{LEAD_STAGE_LABELS[st]}</option>)}</select></label>
                    <label className="label label-caps">Path<select name="triggerPathId" defaultValue={s.triggerPathId || ""} className="admin-input admin-input-sm"><option value="">Any</option>{pathRows.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
                    <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8, height: 34 }}>Save</button>
                  </form>
                  <H>Steps</H>
                  <Sortable ids={mine.map((x) => x.id)} onReorder={reorderSteps.bind(null, s.id)} handleTop>
                    {mine.map((x, i) => (
                      <form key={x.id} action={saveSequenceStep} style={{ display: "grid", gridTemplateColumns: "90px 90px 1fr auto", gap: 8, padding: 10, borderRadius: 10, border: "1px solid #eef0f4" }}>
                        <input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="stepId" value={x.id} />
                        <label className="label label-caps">Wait (h)<input name="delayHours" type="number" min={0} defaultValue={x.delayHours} className="admin-input admin-input-sm" /></label>
                        <label className="label label-caps">Channel<select name="channel" defaultValue={x.channel} className="admin-input admin-input-sm"><option value="email">Email</option><option value="sms">SMS</option></select></label>
                        <label className="label label-caps">Subject<input name="subject" defaultValue={x.subject || ""} className="admin-input admin-input-sm" placeholder="(email only)" /></label>
                        <span style={{ fontSize: 11, color: "#8c95a8", alignSelf: "end", paddingBottom: 8 }}>step {i + 1}</span>
                        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Message<textarea name="body" rows={3} defaultValue={x.body} className="admin-input" /></label>
                        <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, color: "#8c95a8" }}>Variables: {"{{first_name}} {{name}} {{email}} {{booking_link}} {{review_link}}"}</span><span style={{ display: "flex", gap: 12 }}><button type="submit" className="link-btn">Save step</button><button formAction={deleteSequenceStep} className="link-btn link-danger">Remove</button></span></div>
                      </form>))}
                  </Sortable>
                  <form action={saveSequenceStep} style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="delayHours" value={72} /><input type="hidden" name="channel" value="email" /><input name="subject" placeholder="Subject" className="admin-input admin-input-sm" style={{ width: 200 }} /><input name="body" placeholder="Message…" className="admin-input admin-input-sm" required /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>+ Step</button></form>
                  <form action={sequenceAction} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #eef0f4", paddingTop: 10 }}><input type="hidden" name="sequenceId" value={s.id} /><input type="hidden" name="op" value="enroll" /><select name="leadId" className="admin-input admin-input-sm" style={{ width: 240 }} defaultValue="">{leadOpts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select><button type="submit" className="link-btn">Enroll this lead manually</button></form>
                </Card>); })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="New sequence">
                <form action={saveSequence} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input name="name" placeholder="Commercial lead nurture" className="admin-input admin-input-sm" required />
                  <select name="triggerStage" className="admin-input admin-input-sm" defaultValue="new">{LEAD_STAGES.map((st) => <option key={st} value={st}>{LEAD_STAGE_LABELS[st]}</option>)}</select>
                  <select name="triggerPathId" className="admin-input admin-input-sm" defaultValue=""><option value="">Any path</option>{pathRows.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
                  <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Create</button>
                </form>
                <form action={enrollMatchingLeads}><button type="submit" className="link-btn link-muted">Enroll existing leads that match active sequences</button></form>
              </Card>
              <Card title="Enrollments" sub="Drips send via the “drips” cron job">
                {enrolls.slice(0, 40).map(({ e, lead, seq }) => <div key={e.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 80px auto", gap: 8, fontSize: 12, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f2f4f7" }}><span><strong>{lead}</strong> · {seq} · step {e.currentStep + 1}{e.nextSendAt && e.status === "active" ? ` · next ${relativeDay(e.nextSendAt)}` : ""}</span><StatusPill status={e.status} /><span style={{ display: "flex", gap: 8 }}>{e.status === "active" ? <form action={enrollmentAction}><input type="hidden" name="enrollmentId" value={e.id} /><input type="hidden" name="op" value="stop" /><button type="submit" className="link-btn link-muted">Stop</button></form> : <form action={enrollmentAction}><input type="hidden" name="enrollmentId" value={e.id} /><input type="hidden" name="op" value="resume" /><button type="submit" className="link-btn link-muted">Resume</button></form>}<form action={enrollmentAction}><input type="hidden" name="enrollmentId" value={e.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this enrollment?">×</ConfirmButton></form></span></div>)}
                {!enrolls.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No enrollments yet.</span>}
              </Card>
            </div>
          </div>
        </>);
      })()}

      {tab === "sms" && await (async () => {
        const rows = await db.select().from(smsTemplates).orderBy(asc(smsTemplates.category), asc(smsTemplates.id));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
            <Card title="SMS templates" sub={smsRoute() === "cft" ? `Sent through Call Flow Tracker from ${env.cft.smsFrom}` : smsRoute() === "twilio" ? "Sent through Twilio" : "Call Flow Tracker / Twilio not configured — texts are logged to the outbox"}>
              {rows.map((t) => (
                <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid #f2f4f7" }}>
                  <form action={saveSmsTemplate} style={{ display: "grid", gridTemplateColumns: "1fr 130px auto", gap: 8 }}>
                    <input type="hidden" name="templateId" value={t.id} />
                    <input name="name" defaultValue={t.name} className="admin-input admin-input-sm" /><input name="category" defaultValue={t.category} className="admin-input admin-input-sm" /><button type="submit" className="link-btn">Save</button>
                    <textarea name="body" rows={2} defaultValue={t.body} className="admin-input" style={{ gridColumn: "1/-1" }} maxLength={320} />
                  </form>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <form action={smsTemplateAction} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="hidden" name="templateId" value={t.id} /><input type="hidden" name="op" value="send" /><select name="leadId" className="admin-input admin-input-sm" style={{ width: 220 }} defaultValue="">{leadOpts.filter((l) => l.phone).map((l) => <option key={l.id} value={l.id}>{l.name} · {l.phone}</option>)}</select><button type="submit" className="link-btn">Send to lead</button></form>
                    <form action={smsTemplateAction}><input type="hidden" name="templateId" value={t.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${t.name}”?`}>Delete</ConfirmButton></form>
                  </div>
                </div>))}
            </Card>
            <Card title="New template">
              <form action={saveSmsTemplate} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input name="name" placeholder="Template name" className="admin-input admin-input-sm" required /><input name="category" placeholder="Category" defaultValue="Follow-up" className="admin-input admin-input-sm" />
                <textarea name="body" rows={4} placeholder="Hi {{first_name}}, …" className="admin-input" maxLength={320} required />
                <span style={{ fontSize: 11, color: "#8c95a8" }}>Variables: {"{{first_name}} {{name}} {{consult_type}} {{when}} {{time}} {{review_link}}"}. Include “Reply STOP to opt out” on marketing texts.</span>
                <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>+ Add template</button>
              </form>
            </Card>
          </div>);
      })()}

      {tab === "proposals" && await (async () => {
        const [rows, projOpts] = await Promise.all([db.select({ p: proposals, lead: leads.name, project: projects.code }).from(proposals).leftJoin(leads, eq(leads.id, proposals.leadId)).leftJoin(projects, eq(projects.id, proposals.projectId)).orderBy(desc(proposals.updatedAt)), db.select({ id: projects.id, code: projects.code, name: projects.name }).from(projects).where(eq(projects.status, "active"))]);
        const open = rows.find((r) => r.p.id === Number(sp.open));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
            <Card title="Proposals" sub={env.dropboxSignKey ? "E-sign via Dropbox Sign" : "Built-in click-to-sign (typed name + IP + timestamp). Add DROPBOX_SIGN_API_KEY for a third-party envelope."}>
              {rows.map(({ p, lead, project }) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 90px 90px auto", gap: 10, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600 }}>{p.title}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{lead || p.recipientName || "—"}{project ? ` · ${project}` : ""}{p.sentAt ? ` · sent ${relativeDay(p.sentAt)}` : ""}{p.signedAt ? ` · signed by ${p.signerName}` : p.viewedAt ? " · viewed" : ""}</span></div>
                  <span style={{ fontWeight: 600 }}>{p.amount ? money(Number(p.amount)) : "—"}</span>
                  <StatusPill status={p.status} />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Link href={`/admin/ops?tab=proposals&open=${p.id}`} className="link-btn">Edit</Link>
                    <a href={`/proposal/${p.token}`} target="_blank" rel="noreferrer" className="link-btn link-muted">View</a>
                    {p.status !== "signed" && <form action={proposalAction}><input type="hidden" name="proposalId" value={p.id} /><input type="hidden" name="op" value="send" /><button type="submit" className="link-btn">{p.status === "draft" ? "Send" : "Resend"}</button></form>}
                    {p.status !== "signed" && <form action={proposalAction} style={{ display: "flex", gap: 4 }}><input type="hidden" name="proposalId" value={p.id} /><input type="hidden" name="op" value="signed_offline" /><input name="signerName" placeholder="Signer" className="admin-input admin-input-sm" style={{ width: 90, height: 26 }} /><button type="submit" className="link-btn link-muted">Signed offline</button></form>}
                    {p.status === "signed" && <form action={proposalAction}><input type="hidden" name="proposalId" value={p.id} /><input type="hidden" name="op" value="reopen" /><ConfirmButton message="Reopen this signed proposal as a draft?" className="link-btn link-muted">Reopen</ConfirmButton></form>}
                    <form action={proposalAction}><input type="hidden" name="proposalId" value={p.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${p.title}”?`}>Delete</ConfirmButton></form>
                  </div>
                </div>))}
              {!rows.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No proposals yet.</span>}
            </Card>
            <Card title={open ? "Edit proposal" : "New proposal"} action={open && <Link href="/admin/ops?tab=proposals" className="link-btn link-muted">New instead</Link>}>
              <form action={saveProposal} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {open && <input type="hidden" name="proposalId" value={open.p.id} />}
                <input name="title" defaultValue={open?.p.title || ""} placeholder="Kitchen renovation — design & management" className="admin-input admin-input-sm" required />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label className="label label-caps">Lead<select name="leadId" defaultValue={open?.p.leadId ?? ""} className="admin-input admin-input-sm"><option value="">—</option>{leadOpts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                  <label className="label label-caps">Project<select name="projectId" defaultValue={open?.p.projectId ?? ""} className="admin-input admin-input-sm"><option value="">—</option>{projOpts.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
                  <label className="label label-caps">Amount ($)<input name="amount" type="number" step="0.01" defaultValue={open?.p.amount ? Number(open.p.amount) : ""} className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps">Recipient email<input name="recipientEmail" type="email" defaultValue={open?.p.recipientEmail || ""} placeholder="defaults to the lead's" className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Recipient name<input name="recipientName" defaultValue={open?.p.recipientName || ""} className="admin-input admin-input-sm" /></label>
                </div>
                <label className="label label-caps">Proposal body<span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#8c95a8" }}> · plain text or HTML</span><textarea name="body" rows={12} defaultValue={open?.p.body || ""} className="admin-input" required placeholder="Scope, deliverables, timeline, investment and terms…" /></label>
                <div style={{ display: "flex", gap: 8 }}><button type="submit" name="intent" value="save" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Save draft</button><button type="submit" name="intent" value="send" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save & send for signature</button></div>
              </form>
            </Card>
          </div>);
      })()}

      {tab === "invoices" && await (async () => {
        const rows = await db.select({ i: invoices, project: projects }).from(invoices).innerJoin(projects, eq(projects.id, invoices.projectId)).orderBy(desc(invoices.updatedAt)).limit(200);
        return (
          <Card title="Invoices" sub={env.stripe.secret ? "Stripe connected — “Send” creates and emails a hosted Stripe invoice; payments mark themselves paid through the webhook." : "Stripe not configured — invoices are emailed as plain notices and marked paid manually. Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to switch on hosted payments."}>
            <div className="th" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) 100px 90px auto", gap: 12, paddingBottom: 6 }}><span>Invoice</span><span>Project</span><span>Amount</span><span>Status</span><span /></div>
            {rows.map(({ i, project }) => (
              <div key={i.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) 100px 90px auto", gap: 12, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 600 }}>{i.label}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{i.paidAt ? `Paid ${relativeDay(i.paidAt)}` : i.dueAt ? `Due ${relativeDay(i.dueAt)}` : "No due date"}{i.stripeHostedUrl && <> · <a href={i.stripeHostedUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>Stripe</a></>}</span></div>
                <Link href={`/admin/projects?open=${project.id}`} style={{ color: "#1a2238" }}>{project.code} · {project.name}</Link>
                <span style={{ fontWeight: 600 }}>{money(Number(i.amount))}</span>
                <StatusPill status={i.status} />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {["send", "paid", "void", "pending", "delete"].filter((op) => (op === "send" && i.status === "pending") || (op === "paid" && i.status !== "paid" && i.status !== "void") || (op === "void" && i.status !== "void" && i.status !== "paid") || (op === "pending" && i.status === "paid") || op === "delete").map((op) => (
                    <form key={op} action={invoiceAction}><input type="hidden" name="invoiceId" value={i.id} /><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="op" value={op} /><input type="hidden" name="_back" value="/admin/ops?tab=invoices" />{op === "delete" ? <ConfirmButton message="Delete this invoice?">Delete</ConfirmButton> : op === "void" ? <ConfirmButton message="Void this invoice?" className="link-btn link-muted">Void</ConfirmButton> : <button type="submit" className={`link-btn${op === "pending" ? " link-muted" : ""}`}>{{ send: "Send", paid: "Mark paid", pending: "Reopen" }[op]}</button>}</form>))}
                </div>
              </div>))}
            {!rows.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No invoices yet — add them from a project.</span>}
          </Card>);
      })()}

      {tab === "approvals" && await (async () => {
        const rows = await db.select({ a: approvals, project: projects }).from(approvals).innerJoin(projects, eq(projects.id, approvals.projectId)).orderBy(desc(approvals.requestedAt)).limit(200);
        return (
          <Card title="Client approvals" sub="Requested from the project drawer or by stage automation; clients respond in their portal">
            {rows.map(({ a, project }) => (
              <div key={a.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) 120px auto", gap: 12, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
                <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 600 }}>{a.title}</span><span style={{ fontSize: 12, color: "#6b7486" }}>requested {relativeDay(a.requestedAt)}{a.respondedAt ? ` · answered ${relativeDay(a.respondedAt)}: ${a.responseNote || ""}` : ""}</span></div>
                <Link href={`/admin/projects?open=${project.id}`} style={{ color: "#1a2238" }}>{project.code} · {project.name}</Link>
                <StatusPill status={a.status} />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  {a.status === "pending" ? <><form action={approvalAction}><input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="approve" /><input type="hidden" name="_back" value="/admin/ops?tab=approvals" /><button type="submit" className="link-btn">Record approved</button></form><form action={approvalAction}><input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="changes" /><input type="hidden" name="_back" value="/admin/ops?tab=approvals" /><button type="submit" className="link-btn link-muted">Changes requested</button></form></> : <form action={approvalAction}><input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="reopen" /><input type="hidden" name="_back" value="/admin/ops?tab=approvals" /><button type="submit" className="link-btn link-muted">Reopen</button></form>}
                  <form action={approvalAction}><input type="hidden" name="approvalId" value={a.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value="/admin/ops?tab=approvals" /><ConfirmButton message="Delete this approval request?">Delete</ConfirmButton></form>
                </div>
              </div>))}
            {!rows.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No approval requests yet.</span>}
          </Card>);
      })()}

      {tab === "webhooks" && await (async () => {
        const [subs, dels, inbound] = await Promise.all([db.select().from(webhookSubscriptions).orderBy(asc(webhookSubscriptions.id)), db.select({ d: webhookDeliveries, sub: webhookSubscriptions.name }).from(webhookDeliveries).innerJoin(webhookSubscriptions, eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId)).orderBy(desc(webhookDeliveries.createdAt)).limit(40), db.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(40)]);
        return (<>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
            <Card title="Outbound subscriptions" sub="Signed with X-GID-Signature: sha256=<hmac>. Call Flow Tracker, Zapier or any CRM can subscribe.">
              {subs.map((s) => (
                <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderBottom: "1px solid #f2f4f7", opacity: s.isActive ? 1 : .55 }}>
                  <form action={saveWebhook} style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr) auto", gap: 8 }}>
                    <input type="hidden" name="webhookId" value={s.id} />
                    <input name="name" defaultValue={s.name} className="admin-input admin-input-sm" /><input name="url" defaultValue={s.url} className="admin-input admin-input-sm" /><button type="submit" className="link-btn">Save</button>
                    <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, flexWrap: "wrap" }}>{["*", ...GID_EVENTS].map((e) => <label key={e} style={{ fontSize: 11, display: "flex", gap: 3, alignItems: "center" }}><input type="checkbox" name="events" value={e} defaultChecked={s.events.includes(e)} />{e}</label>)}</div>
                  </form>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", fontSize: 11 }}>
                    <form action={webhookAction}><input type="hidden" name="webhookId" value={s.id} /><input type="hidden" name="op" value="test" /><button type="submit" className="link-btn">Send ping</button></form>
                    <form action={webhookAction}><input type="hidden" name="webhookId" value={s.id} /><input type="hidden" name="op" value="rotate" /><ConfirmButton message="Rotate the signing secret? The receiver must be updated." className="link-btn link-muted">Rotate secret</ConfirmButton></form>
                    <form action={webhookAction}><input type="hidden" name="webhookId" value={s.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" className="link-btn link-muted">{s.isActive ? "Pause" : "Resume"}</button></form>
                    <form action={webhookAction}><input type="hidden" name="webhookId" value={s.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove the “${s.name}” subscription?`}>Remove</ConfirmButton></form>
                  </div>
                </div>))}
              <form action={saveWebhook} style={{ display: "grid", gridTemplateColumns: "140px minmax(0, 1fr) auto", gap: 8, paddingTop: 8 }}>
                <input name="name" placeholder="Name" className="admin-input admin-input-sm" /><input name="url" placeholder="https://receiver.example.com/webhooks/gid" className="admin-input admin-input-sm" required /><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>+ Add</button>
                <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, flexWrap: "wrap" }}>{["*", ...GID_EVENTS].map((e) => <label key={e} style={{ fontSize: 11, display: "flex", gap: 3, alignItems: "center" }}><input type="checkbox" name="events" value={e} defaultChecked={e === "*"} />{e}</label>)}</div>
              </form>
              <form action={emitTestEvent} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid #eef0f4", paddingTop: 10 }}><select name="event" className="admin-input admin-input-sm" style={{ width: 220 }} defaultValue="lead.created">{GID_EVENTS.map((e) => <option key={e} value={e}>{e}</option>)}</select><button type="submit" className="link-btn">Emit a test event</button></form>
            </Card>
            <Card title="Call Flow Tracker" sub="Inbound side of the integration">
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "#4b5569", display: "flex", flexDirection: "column", gap: 6 }}>
                <span>Inbound webhook: <code>{env.baseUrl}/api/webhooks/cft</code><br /><span style={{ fontSize: 12, color: "#6b7486" }}>Header <code>X-CallFlow-Signature: sha256=&lt;hmac&gt;</code> with <code>CFT_WEBHOOK_SECRET</code>. Call events create or update leads and log activity.</span></span>
                <span>Connected Apps SSO: <code>/api/sso/launch</code>, <code>/api/master/users</code>, <code>/api/master/sessions/revoke</code>, <code>/api/dashboard-metrics</code><br /><span style={{ fontSize: 12, color: "#6b7486" }}>Secret <code>CFT_SSO_SECRET</code> · app id <code>{env.cft.appId}</code> · CFT URL {env.cft.url || "(set CFT_URL)"}</span></span>
                <span>Status: <StatusPill status={env.cft.webhookSecret || env.cft.ssoSecret ? "connected" : "not_connected"} /></span>
              </div>
              <H>Inbound events</H>
              {inbound.map((e) => <div key={e.id} style={{ display: "grid", gridTemplateColumns: "70px minmax(0, 1fr) 80px 90px", gap: 8, fontSize: 12, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f2f4f7" }}><span className="tag">{e.source}</span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.eventType}{e.error ? ` · ${e.error}` : ""}</span><StatusPill status={e.status} /><span style={{ color: "#8c95a8" }}>{relativeDay(e.receivedAt)}</span></div>)}
              {!inbound.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No inbound events received yet.</span>}
            </Card>
          </div>
          <Card title="Recent deliveries">
            {dels.map(({ d, sub }) => <div key={d.id} style={{ display: "grid", gridTemplateColumns: "140px 180px minmax(0, 1fr) 80px auto", gap: 10, fontSize: 12, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f2f4f7" }}><span>{sub}</span><span className="tag">{d.event}</span><span style={{ color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.attempts} attempt{d.attempts === 1 ? "" : "s"}{d.responseStatus ? ` · HTTP ${d.responseStatus}` : ""}{d.lastError ? ` · ${d.lastError}` : ""} · {relativeDay(d.createdAt)}</span><StatusPill status={d.status} /><span style={{ display: "flex", gap: 8 }}><form action={deliveryAction}><input type="hidden" name="deliveryId" value={d.id} /><input type="hidden" name="op" value="retry" /><button type="submit" className="link-btn">Retry</button></form><form action={deliveryAction}><input type="hidden" name="deliveryId" value={d.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this delivery record?">×</ConfirmButton></form></span></div>)}
            {!dels.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing delivered yet.</span>}
          </Card>
        </>);
      })()}

      {tab === "outbox" && await (async () => {
        const rows = await db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(150);
        return (
          <Card title="Email & SMS outbox" sub={`${env.sendgridApiKey ? "SendGrid (noreply@ · support@ · consultation@ · newsletter@)" : "Email: logged only (no SENDGRID_API_KEY)"} · ${smsRoute() === "cft" ? "SMS via Call Flow Tracker" : smsRoute() === "twilio" ? "SMS via Twilio" : "SMS: logged only"} · every message the app sends lands here first`} action={<form action={purgeOutbox}><ConfirmButton message="Delete outbox records older than 30 days?" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Purge &gt; 30 days</ConfirmButton></form>}>
            {rows.map((m) => (
              <details key={m.id} style={{ borderBottom: "1px solid #f2f4f7", padding: "6px 0" }}>
                <summary style={{ display: "grid", gridTemplateColumns: "60px minmax(0, 1.2fr) minmax(0, 2fr) 80px 90px auto", gap: 10, fontSize: 12, alignItems: "center", cursor: "pointer", listStyle: "none" }}>
                  <span className="tag" title={m.fromAddr || ""}>{m.channel}{m.fromAddr ? ` · ${m.fromAddr.replace(/^.*<|>.*$/g, "").split("@")[0]}` : ""}</span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.fromAddr ? `from ${m.fromAddr}` : undefined}>{m.toAddr}</span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.subject || m.bodyText?.slice(0, 80)}</span><StatusPill status={m.status} /><span style={{ color: "#8c95a8" }}>{relativeDay(m.createdAt)}</span>
                  <span style={{ display: "flex", gap: 8 }}>{m.status !== "sent" && <form action={outboxAction}><input type="hidden" name="outboxId" value={m.id} /><input type="hidden" name="op" value="retry" /><button type="submit" className="link-btn">Re-send</button></form>}<form action={outboxAction}><input type="hidden" name="outboxId" value={m.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message="Delete this message record?">×</ConfirmButton></form></span>
                </summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#4b5569", background: "#f7f9fc", padding: 10, borderRadius: 8, marginTop: 6 }}>{m.error ? `ERROR: ${m.error}\n\n` : ""}{m.bodyText}</pre>
              </details>))}
            {!rows.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing sent yet.</span>}
          </Card>);
      })()}

      {tab === "jobs" && await (async () => {
        const [runs, hs] = await Promise.all([db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(40), db.select().from(hubspotSync).orderBy(desc(hubspotSync.lastSyncedAt)).limit(30)]);
        return (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
            <Card title="Scheduled jobs" sub="On Replit, a Scheduled Deployment runs `npm run cron -- all` (or hits /api/cron/<job> with the CRON_SECRET bearer token). Run any job by hand here.">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{JOBS.map((j) => <form key={j} action={runCronJob}><input type="hidden" name="job" value={j} /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Run {j}</button></form>)}</div>
              <div style={{ fontSize: 12, color: "#6b7486", lineHeight: 1.6 }}>reminders → 24h booking reminders · rss → import feeds · etsy → refresh listings · social → publish due posts + sync feeds · drips → send due sequence steps · webhooks → retry deliveries · outbox → retry queued mail/SMS · hubspot → push contacts & deals</div>
              <H>Recent runs</H>
              {runs.map((r) => <div key={r.id} style={{ display: "grid", gridTemplateColumns: "90px 80px minmax(0, 1fr) 90px", gap: 10, fontSize: 12, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f2f4f7" }}><span className="tag">{r.job}</span><StatusPill status={r.status} /><span style={{ color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{JSON.stringify(r.summary || {})}</span><span style={{ color: "#8c95a8" }}>{fmtDateTime(r.startedAt)}</span></div>)}
              {!runs.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No runs recorded yet.</span>}
            </Card>
            <Card title="HubSpot sync" sub={env.hubspotToken ? "Connected — leads become contacts, projects become deals" : "Add HUBSPOT_ACCESS_TOKEN (private app) to enable. Until then, nothing is pushed."}>
              <form action={hubspotSyncNow}><input type="hidden" name="kind" value="all" /><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }} disabled={!env.hubspotToken}>Sync everything changed recently</button></form>
              {hs.map((h) => <div key={h.id} style={{ display: "grid", gridTemplateColumns: "70px 60px minmax(0, 1fr) 80px", gap: 8, fontSize: 12, alignItems: "center", padding: "4px 0", borderBottom: "1px solid #f2f4f7" }}><span className="tag">{h.objectType}</span><span>#{h.objectId}</span><span style={{ color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.hubspotId ? `HubSpot ${h.hubspotId}` : ""}{h.error ? ` · ${h.error}` : ""}{h.lastSyncedAt ? ` · ${relativeDay(h.lastSyncedAt)}` : ""}</span><StatusPill status={h.status} /></div>)}
              {!hs.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing synced yet.</span>}
            </Card>
          </div>);
      })()}
    </AdminShell>
  );
}
