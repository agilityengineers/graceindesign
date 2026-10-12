"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "./ui";
import { moveProjectStage } from "@/lib/actions/projects";
import { money, relativeDay } from "@/lib/utils";

export type ProjectRow = { id: number; code: string; name: string; service: string; stageId: number | null; stage: string; phase: string; value: number; billed: number; owner: string; signedAt: string | null; targetDate: string | null; nextMilestone: string | null; status: string };
export type StageCol = { id: number; name: string; phase: string; color: string };

export default function ProjectsView({ rows, stages, view, filter }: { rows: ProjectRow[]; stages: StageCol[]; view: "board" | "table"; filter: string }) {
  const router = useRouter(); const sp = useSearchParams();
  const [local, setLocal] = useState(rows);
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [, start] = useTransition();
  const justDragged = { current: false } as { current: boolean };
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp.toString()); if (v == null || v === "") n.delete(k); else n.set(k, v); n.delete("open"); router.push(`/admin/projects${n.toString() ? `?${n}` : ""}`); };
  const open = (id: number) => { if (justDragged.current) { justDragged.current = false; return; } const n = new URLSearchParams(sp.toString()); n.set("open", String(id)); router.push(`/admin/projects?${n}`); };
  const drop = (stageId: number) => { const id = dragId; setDragId(null); setOver(null); if (id == null) return; const row = local.find((r) => r.id === id); if (!row || row.stageId === stageId) return; const st = stages.find((s) => s.id === stageId)!; setLocal((ls) => ls.map((r) => (r.id === id ? { ...r, stageId, stage: st.name, phase: st.phase } : r))); start(async () => { await moveProjectStage(id, stageId); router.refresh(); }); };
  const filters = ["Active", "All", "Closed", "Archived"];
  return (<>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{filters.map((f) => <button key={f} type="button" className={`pill${filter === f ? " is-on" : ""}`} onClick={() => setParam("filter", f === "Active" ? null : f)}>{f}</button>)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="seg"><button type="button" className={view === "board" ? "is-on" : ""} onClick={() => setParam("view", null)}>Board</button><button type="button" className={view === "table" ? "is-on" : ""} onClick={() => setParam("view", "table")}>Table</button></div>
        <Link href="/admin/projects?view=config" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Configure stages</Link>
        <Link href="/admin/projects/new" className="btn btn-navy btn-sm" style={{ height: 40, borderRadius: 10 }}>+ New project</Link>
      </div>
    </div>
    {view === "table" ? (
      <div style={{ background: "#fff", border: "1px solid #e3e6ec", borderRadius: 14, overflow: "hidden" }}>
        <div className="th" style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr 1.2fr .9fr .9fr 1fr 1fr", gap: 16, padding: "12px 20px", borderBottom: "1px solid #eef0f4" }}><span>Project</span><span>Service</span><span>Stage</span><span>Contract value</span><span>Billed</span><span>Owner</span><span>Next milestone</span></div>
        {local.map((p) => (
          <button type="button" key={p.id} onClick={() => open(p.id)} className="row-hover" style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr 1.2fr .9fr .9fr 1fr 1fr", gap: 16, alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f2f4f7", background: sp.get("open") === String(p.id) ? "#f2f8fd" : "#fff", color: "#1a2238", fontSize: 13, width: "100%", textAlign: "left", border: 0, borderBottomWidth: 1, cursor: "pointer", font: "inherit" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}{p.status !== "active" && <span className="tag" style={{ marginLeft: 8 }}>{p.status}</span>}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{p.code}{p.signedAt ? ` · signed ${relativeDay(p.signedAt)}` : ""}</span></div>
            <span style={{ fontSize: 12, color: "#4b5569" }}>{p.service}</span>
            <span><span className="status-pill" style={{ background: "#e6f3fc", color: "#1a2238" }}>{p.stage}</span></span>
            <span style={{ fontWeight: 600 }}>{money(p.value)}</span>
            <span style={{ fontSize: 12, color: "#4b5569" }}>{money(p.billed)}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><Avatar name={p.owner} size={24} dark />{p.owner}</span>
            <span style={{ fontSize: 12, color: "#6b7486" }}>{p.nextMilestone || "—"}</span>
          </button>))}
        {!local.length && <div style={{ padding: 32, textAlign: "center", color: "#8c95a8", fontSize: 13 }}>No projects here yet. Mark a lead as signed, or <Link href="/admin/projects/new" style={{ color: "#3f9ad9", fontWeight: 600 }}>create one</Link>.</div>}
      </div>
    ) : (<>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#e6f3fc", fontSize: 12 }}><strong>Drag a project card between stages.</strong>&nbsp;Stages are grouped into phases (Agreement → Design → Build → Billing → Closed); edit them under <Link href="/admin/projects?view=config" style={{ color: "#3f9ad9", fontWeight: 600, marginLeft: 4 }}>Configure stages</Link>.</div>
      <div className="kanban" style={{ gridAutoColumns: "minmax(190px, 1fr)" }}>
        {stages.map((st) => { const cards = local.filter((p) => p.stageId === st.id); return (
          <div key={st.id} className={`kanban-col${over === st.id && dragId != null ? " is-over" : ""}`} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== st.id) setOver(st.id); }} onDragLeave={() => setOver((o) => (o === st.id ? null : o))} onDrop={(e) => { e.preventDefault(); drop(st.id); }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 4px" }}><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: st.color }}>{st.phase}</span><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 12, fontWeight: 700, color: "#1a2238" }}>{st.name}</span><span style={{ fontSize: 11, color: "#6b7486", fontWeight: 600 }}>{cards.length}</span></div></div>
            {cards.map((p) => (
              <div key={p.id} role="button" tabIndex={0} draggable className={`kanban-card${dragId === p.id ? " is-dragging" : ""}`} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(p.id); }} onDragEnd={() => { justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0); setDragId(null); setOver(null); }} onClick={() => open(p.id)} onKeyDown={(e) => { if (e.key === "Enter") open(p.id); }}>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "#8c95a8" }}>{p.code}</span>
                <span style={{ fontSize: 11, color: "#6b7486", lineHeight: 1.4 }}>{p.service} · {money(p.value)}</span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}><span style={{ fontSize: 11, color: p.targetDate && /Today|Tomorrow|Yesterday/.test(relativeDay(p.targetDate)) ? "#e0532f" : "#6b7486" }}>{p.nextMilestone || (p.targetDate ? `Due ${relativeDay(p.targetDate)}` : "")}</span><Avatar name={p.owner} size={22} dark /></div>
              </div>))}
          </div>); })}
      </div>
    </>)}
  </>);
}
