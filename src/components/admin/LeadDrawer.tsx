"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Close, Check } from "@/components/ui/Icons";
import { Avatar } from "./ui";
import ConfirmButton from "./Confirm";
import { updateLead, addLeadActivity, attachLeadDocument, markLeadSigned, deleteLead, archiveLead, cancelBooking } from "@/lib/actions/leads";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/db/constants";
import type { Lead } from "@/lib/db/schema";
import { fmtDateTime, relativeDay } from "@/lib/utils";

type Activity = { id: number; type: string; body: string; attachmentUrl: string | null; createdAt: string; userName: string | null };
type Booking = { id: number; startsAt: string; endsAt: string; status: string };
const ICON: Record<string, [string, string]> = { note: ["✎", "#f2f4f7"], call: ["☎", "#fff4d6"], email: ["✉", "#e6f3fc"], sms: ["✉", "#e6f3fc"], proposal: ["▲", "#dcefe4"], stage: ["●", "#e6f3fc"], system: ["●", "#f2f4f7"], booking: ["◷", "#e9e4fb"], webhook: ["⇄", "#fbe9e2"] };

export default function LeadDrawer({ lead, activity, bookings, documents, team, paths, project, canDelete, cftUrl }: { lead: Lead & { createdAt: string; consentAt: string | null }; activity: Activity[]; bookings: Booking[]; documents: { id: number; name: string; url: string; type: string }[]; team: { id: number; name: string }[]; paths: { id: string; label: string }[]; project: { id: number; code: string; name: string } | null; canDelete: boolean; cftUrl?: string | null }) {
  const router = useRouter(); const sp = useSearchParams();
  const back = `/admin/leads?${(() => { const n = new URLSearchParams(sp.toString()); n.set("open", String(lead.id)); return n.toString(); })()}`;
  const close = () => { const n = new URLSearchParams(sp.toString()); n.delete("open"); n.delete("ok"); n.delete("err"); router.push(`/admin/leads${n.toString() ? `?${n}` : ""}`); };
  const [tab, setTab] = useState<"note" | "call" | "email" | "sms" | "proposal">("note");
  const [showConvert, setShowConvert] = useState(false);
  const answers = Object.entries(lead.answers || {}).filter(([k]) => !["consent", "__hp", "cft"].includes(k));
  const upcoming = bookings.find((b) => b.status === "booked");
  return (<>
    <div className="drawer-backdrop" onClick={close} />
    <aside className="drawer" aria-label={`Lead: ${lead.name}`}>
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", gap: 14 }}><Avatar name={lead.name} size={48} /><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 18, fontWeight: 600 }}>{lead.name}</span><span style={{ fontSize: 13, color: "#6b7486" }}>{lead.email} · {lead.phone || "no phone"}</span><div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>{lead.tags.map((t) => <span key={t} className="tag">{t}</span>)}<span className="tag" style={{ border: "1px dashed #c6cbd6", background: "transparent" }}>+ tag below</span>{cftUrl && <a href={cftUrl} target="_blank" rel="noreferrer" className="tag" style={{ background: "#e6f3fc", color: "#1a2238", fontWeight: 600 }} title="Signs you into Call Flow Tracker with your own account">Open in Call Flow Tracker ↗</a>}</div></div></div>
        <button type="button" onClick={close} aria-label="Close" style={{ width: 34, height: 34, borderRadius: "50%", background: "#f2f4f7", border: 0, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", cursor: "pointer" }}><Close /></button>
      </div>
      <form action={updateLead} style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, borderBottom: "1px solid #eef0f4" }}>
        <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="_back" value={back} />
        <label className="label label-caps">Stage<select name="stage" defaultValue={lead.stage} className="admin-input">{LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}</select></label>
        <label className="label label-caps">Owner<select name="ownerId" defaultValue={lead.ownerId ?? ""} className="admin-input">{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="">Unassigned</option></select></label>
        <label className="label label-caps">Follow-up reminder<input type="date" name="followUpAt" defaultValue={lead.followUpAt || ""} className="admin-input" /></label>
        <div className="label label-caps">Source<span style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 8, background: "#e6f3fc", fontSize: 13, color: "#1a2238", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3f9ad9" }} />{lead.sourceLabel || lead.sourcePage}</span></div>
        <label className="label label-caps">Name<input name="name" defaultValue={lead.name} className="admin-input" /></label>
        <label className="label label-caps">Path<select name="pathId" defaultValue={lead.pathId ?? ""} className="admin-input"><option value="">—</option>{paths.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="label label-caps">Email<input name="email" type="email" defaultValue={lead.email || ""} className="admin-input" /></label>
        <label className="label label-caps">Phone<input name="phone" defaultValue={lead.phone || ""} className="admin-input" /></label>
        <label className="label label-caps">Budget<input name="budget" defaultValue={lead.budget || ""} className="admin-input" /></label>
        <label className="label label-caps">Timeline<input name="timeline" defaultValue={lead.timeline || ""} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Address<input name="address" defaultValue={lead.address || ""} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Tags (comma-separated)<input name="tags" defaultValue={lead.tags.join(", ")} className="admin-input" /></label>
        <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Internal notes<textarea name="notes" rows={2} defaultValue={lead.notes || ""} className="admin-input" /></label>
        <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#8c95a8" }}>Received {fmtDateTime(lead.createdAt)}{lead.consentAt ? " · consent on file" : " · no consent recorded"}{lead.utm && Object.keys(lead.utm).filter((k) => k.startsWith("utm")).length ? ` · ${Object.entries(lead.utm).filter(([k]) => k.startsWith("utm")).map(([k, v]) => `${k.replace("utm_", "")}=${v}`).join(" ")}` : ""}</span>
          <button type="submit" className="btn btn-navy btn-sm">Save changes</button>
        </div>
      </form>
      {upcoming && (
        <div style={{ padding: "14px 28px", borderBottom: "1px solid #eef0f4", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f7f9fc", fontSize: 13 }}>
          <span><strong>Consultation booked</strong> · {fmtDateTime(upcoming.startsAt)} ET</span>
          <form action={cancelBooking} style={{ display: "flex", gap: 8 }}><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="bookingId" value={upcoming.id} /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Cancel this consultation?" className="link-btn link-danger">Cancel booking</ConfirmButton></form>
        </div>
      )}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="label-caps">Form answers · consultation path</span>
        {answers.length ? answers.map(([q, a]) => <div key={q} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, fontSize: 13 }}><span style={{ color: "#6b7486" }}>{q.replace(/_/g, " ")}</span><span style={{ fontWeight: 500, wordBreak: "break-word" }}>{Array.isArray(a) ? (a as string[]).map((x, i) => /^https?:|^\//.test(String(x)) ? <a key={i} href={String(x)} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>photo {i + 1} </a> : <span key={i}>{String(x)}{i < (a as string[]).length - 1 ? ", " : ""}</span>) : String(a)}</span></div>) : <span style={{ fontSize: 13, color: "#8c95a8" }}>No form answers recorded.</span>}
        {documents.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>{documents.map((d) => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="tag" style={{ padding: "6px 10px", borderRadius: 8 }}>{d.name}</a>)}</div>}
      </div>
      <div style={{ padding: "16px 28px", borderBottom: "1px solid #eef0f4", display: "flex", flexDirection: "column", gap: 12, background: "#f7f9fc" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 13, fontWeight: 600 }}>Agreement signed?</span><span style={{ fontSize: 12, color: "#6b7486" }}>Converts this lead into a project and moves it to the Project Pipeline.</span></div>
          {project ? <Link href={`/admin/projects?open=${project.id}`} className="btn btn-sm" style={{ background: "#dcefe4", color: "#1f6b3f", borderRadius: 999, height: 40 }}>Signed · View project →</Link>
            : <button type="button" className="btn btn-navy btn-sm" style={{ height: 40, borderRadius: 999 }} onClick={() => setShowConvert((v) => !v)}><Check size={14} color="#6cb6e6" /> Mark signed → create project</button>}
        </div>
        {showConvert && !project && (
          <form action={markLeadSigned} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="_back" value={back} />
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Project name<input name="projectName" defaultValue={`${lead.name} — ${lead.sourceLabel || "Project"}`} className="admin-input" /></label>
            <label className="label label-caps">Contract value ($)<input name="contractValue" type="number" step="0.01" placeholder="e.g. 68400" className="admin-input" /></label>
            <label className="label label-caps">Target completion<input name="targetDate" type="date" className="admin-input" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Site address<input name="address" defaultValue={lead.address || ""} className="admin-input" /></label>
            <span style={{ gridColumn: "1/-1", fontSize: 11, color: "#6b7486" }}>Applies the conversion rules from Project Pipeline → Configure stages (copy answers, deposit invoice, welcome email).</span>
            <button type="submit" className="btn btn-navy btn-sm" style={{ gridColumn: "1/-1" }}>Create project</button>
          </form>
        )}
      </div>
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span className="label-caps">Activity</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(["note", "call", "email", "sms", "proposal"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className="btn btn-xs" style={{ border: `1px solid ${tab === t ? "#1a2238" : "#e3e6ec"}`, background: tab === t ? "#1a2238" : "#fff", color: tab === t ? "#fff" : "#1a2238", borderRadius: 8 }}>{t === "note" ? "Add note" : t === "proposal" ? "Attach proposal" : `Log ${t}`}</button>)}</div>
        </div>
        {tab === "proposal" ? (
          <form action={attachLeadDocument} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} encType="multipart/form-data">
            <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="type" value="proposal" />
            <label className="label label-caps">Name<input name="name" placeholder="Proposal v1" className="admin-input" /></label>
            <label className="label label-caps">File<input name="file" type="file" className="admin-input" style={{ paddingTop: 8 }} /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>…or a link<input name="url" placeholder="https://" className="admin-input" /></label>
            <button type="submit" className="btn btn-navy btn-sm" style={{ gridColumn: "1/-1" }}>Attach proposal (moves to Proposal sent)</button>
          </form>
        ) : (
          <form action={addLeadActivity} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="type" value={tab} />
            {tab === "email" && <input name="subject" placeholder="Subject" className="admin-input" />}
            <textarea name="body" rows={3} placeholder={tab === "note" ? "Add a note…" : tab === "call" ? "What was discussed?" : tab === "sms" ? "Text message…" : "Email body…"} className="admin-input" required />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              {(tab === "email" || tab === "sms") ? <label style={{ fontSize: 12, color: "#4b5569", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="send" value="1" defaultChecked />Actually send to the lead</label> : <span />}
              <button type="submit" className="btn btn-navy btn-sm" style={{ borderRadius: 999 }}>{tab === "note" ? "Save note" : "Log"}</button>
            </div>
          </form>
        )}
        {activity.map((ev) => { const [icon, bg] = ICON[ev.type] || ICON.system; return (
          <div key={ev.id} style={{ display: "flex", gap: 12 }}><span style={{ width: 28, height: 28, flex: "none", borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{icon}</span><div style={{ display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{ev.body}{ev.attachmentUrl && <> · <a href={ev.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9" }}>open</a></>}</span><span style={{ fontSize: 11, color: "#8c95a8" }}>{relativeDay(ev.createdAt)} · {fmtDateTime(ev.createdAt)}{ev.userName ? ` · ${ev.userName}` : ""}</span></div></div>); })}
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #eef0f4", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <form action={archiveLead}><input type="hidden" name="id" value={lead.id} /><input type="hidden" name="archived" value={lead.archived ? "0" : "1"} /><button type="submit" className="link-btn link-muted">{lead.archived ? "Restore lead" : "Archive lead"}</button></form>
          {canDelete && <form action={deleteLead}><input type="hidden" name="id" value={lead.id} /><ConfirmButton message="Permanently delete this lead and its activity? This cannot be undone.">Delete lead</ConfirmButton></form>}
        </div>
      </div>
    </aside>
  </>);
}
