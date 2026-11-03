"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { StagePill, Avatar } from "./ui";
import { moveLeadStage } from "@/lib/actions/leads";
import { relativeDay } from "@/lib/utils";
import type { LeadStage, LeadStageDef } from "@/lib/db/constants";

type Row = { id: number; name: string; email: string; phone: string; source: string; stage: LeadStage; owner: string; createdAt: string; stageChangedAt: string; followUpAt: string | null; tags: string[]; converted: boolean };
export default function LeadsView({ rows, sources, currentSource, view, stages, archived, q, canEditColumns }: { rows: Row[]; sources: string[]; currentSource: string; view: "table" | "board"; stages: LeadStageDef[]; archived: boolean; q: string; canEditColumns?: boolean }) {
  const router = useRouter(); const sp = useSearchParams();
  const [local, setLocal] = useState(rows);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  const [, start] = useTransition();
  const justDragged = { current: false } as { current: boolean };
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp.toString()); if (v == null || v === "" || v === "All") n.delete(k); else n.set(k, v); n.delete("open"); router.push(`/admin/leads${n.toString() ? `?${n}` : ""}`); };
  const open = (id: number) => { if (justDragged.current) { justDragged.current = false; return; } const n = new URLSearchParams(sp.toString()); n.set("open", String(id)); router.push(`/admin/leads?${n}`); };
  const byKey = new Map(stages.map((s) => [s.key, s]));
  const drop = (stage: LeadStage) => { const id = dragId; setDragId(null); setOver(null); if (id == null) return; const row = local.find((r) => r.id === id); if (!row || row.stage === stage || !byKey.has(stage)) return; setLocal((ls) => ls.map((r) => (r.id === id ? { ...r, stage, stageChangedAt: new Date().toISOString() } : r))); start(async () => { await moveLeadStage(id, stage); router.refresh(); }); };
  /** Days left before an auto-delete column (e.g. Trash) removes this lead. */
  const daysLeft = (l: Row) => { const d = byKey.get(l.stage)?.autoDeleteDays; if (!d) return null; return Math.max(0, Math.ceil((new Date(l.stageChangedAt).getTime() + d * 864e5 - Date.now()) / 864e5)); };
  const unknown = local.filter((l) => !byKey.has(l.stage)); // a stage that no longer has a column — show it rather than hide the lead
  const cols: LeadStageDef[] = [...stages, ...Array.from(new Set(unknown.map((l) => l.stage))).map((k) => ({ key: k, label: k.replace(/_/g, " "), bg: "#f2f4f7", fg: "#4b5569", autoDeleteDays: null }))];
  const dueColor = (d: string | null) => (d && /Today|Tomorrow|Yesterday/.test(relativeDay(d)) ? "#e0532f" : "#6b7486");
  return (<>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{sources.map((s) => <button key={s} type="button" className={`pill${currentSource === s ? " is-on" : ""}`} onClick={() => setParam("source", s)}>{s}</button>)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input defaultValue={q} placeholder="Filter by name, email, phone…" className="admin-input" style={{ width: 220 }} onKeyDown={(e) => { if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value); }} />
        <label style={{ fontSize: 12, color: "#6b7486", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={archived} onChange={(e) => setParam("archived", e.target.checked ? "1" : null)} />Archived</label>
        <a href={`/api/admin/export/leads.csv${currentSource !== "All" ? `?source=${encodeURIComponent(currentSource)}` : ""}`} className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Export CSV</a>
        <div className="seg"><button type="button" className={view === "table" ? "is-on" : ""} onClick={() => setParam("view", null)}>Table</button><button type="button" className={view === "board" ? "is-on" : ""} onClick={() => setParam("view", "board")}>Board</button></div>
      </div>
    </div>
    {view === "table" ? (
      <div style={{ background: "#fff", border: "1px solid #e3e6ec", borderRadius: 14, overflow: "hidden" }}>
        <div className="th" style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr .9fr .8fr", gap: 16, padding: "12px 20px", borderBottom: "1px solid #eef0f4" }}><span>Lead</span><span>Source page</span><span>Stage</span><span>Owner</span><span>Received</span><span>Follow-up</span></div>
        {local.map((l) => (
          <button type="button" key={l.id} onClick={() => open(l.id)} className="row-hover" style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1fr 1fr .9fr .8fr", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f2f4f7", background: sp.get("open") === String(l.id) ? "#f2f8fd" : "#fff", color: "#1a2238", fontSize: 13, width: "100%", textAlign: "left", border: 0, borderBottomWidth: 1, cursor: "pointer", font: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><Avatar name={l.name} /><div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}{l.converted && <span className="tag" style={{ marginLeft: 8, background: "#dcefe4", color: "#1f6b3f" }}>Project</span>}</span><span style={{ fontSize: 12, color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.email}</span></div></div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5569" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6cb6e6" }} />{l.source}</span>
            <span><StagePill stage={l.stage} def={byKey.get(l.stage)} /></span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><Avatar name={l.owner} size={24} dark />{l.owner}</span>
            <span style={{ fontSize: 12, color: "#6b7486" }}>{relativeDay(l.createdAt)}</span>
            <span style={{ fontSize: 12, color: dueColor(l.followUpAt), fontWeight: 600 }}>{l.followUpAt ? relativeDay(l.followUpAt) : "—"}</span>
          </button>))}
        {!local.length && <div style={{ padding: 32, textAlign: "center", color: "#8c95a8", fontSize: 13 }}>No leads match. <Link href="/admin/leads/new" style={{ color: "#3f9ad9", fontWeight: 600 }}>Add one</Link>.</div>}
      </div>
    ) : (<>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#e6f3fc", fontSize: 12 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3f9ad9" strokeWidth="2" strokeLinecap="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg><span style={{ flex: 1 }}><strong>Drag a card to another column</strong>&nbsp;to change its stage. Stage changes are logged to the lead's activity timeline.</span>{canEditColumns && <Link href="/admin/leads?view=columns" style={{ color: "#3f9ad9", fontWeight: 600, whiteSpace: "nowrap" }}>Manage columns</Link>}</div>
      <div className="kanban">
        {cols.map((st) => { const cards = local.filter((l) => l.stage === st.key); return (
          <div key={st.key} className={`kanban-col${over === st.key && dragId != null ? " is-over" : ""}`} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== st.key) setOver(st.key); }} onDragLeave={() => setOver((o) => (o === st.key ? null : o))} onDrop={(e) => { e.preventDefault(); drop(st.key); }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#4b5569" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: st.bg, border: `1.5px solid ${st.fg}` }} />{st.label}</span><span style={{ fontSize: 11, color: "#6b7486", fontWeight: 600 }}>{cards.length}</span></div>
            {st.autoDeleteDays ? <span style={{ fontSize: 11, color: "#9a3c1e", padding: "0 4px", lineHeight: 1.4 }}>Leads here are deleted after {st.autoDeleteDays} day{st.autoDeleteDays === 1 ? "" : "s"}</span> : null}
            {cards.map((l) => (
              <div key={l.id} role="button" tabIndex={0} draggable className={`kanban-card${dragId === l.id ? " is-dragging" : ""}`} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(l.id)); setDragId(l.id); }} onDragEnd={() => { justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0); setDragId(null); setOver(null); }} onClick={() => open(l.id)} onKeyDown={(e) => { if (e.key === "Enter") open(l.id); }}>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{l.name}</span>
                <span style={{ fontSize: 11, color: "#6b7486", lineHeight: 1.4 }}>{l.source}</span>
                {(() => { const left = daysLeft(l); return left == null ? null : <span style={{ fontSize: 11, color: "#9a3c1e", fontWeight: 600 }}>{left === 0 ? "Deletes at the next cleanup" : `Deletes in ${left} day${left === 1 ? "" : "s"}`}</span>; })()}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}><span style={{ fontSize: 11, color: "#6b7486" }}>{relativeDay(l.createdAt)}</span><Avatar name={l.owner} size={22} dark /></div>
              </div>))}
          </div>); })}
      </div>
    </>)}
  </>);
}
