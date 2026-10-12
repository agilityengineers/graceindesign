import type { CSSProperties, ReactNode } from "react";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/db/constants";

export const STAGE_COLORS: Record<LeadStage, [string, string]> = { new: ["#e6f3fc", "#1a2238"], contacted: ["#fff4d6", "#7a5a00"], consultation_booked: ["#e9e4fb", "#4a2fa3"], proposal_sent: ["#dcefe4", "#1f6b3f"], won: ["#1a2238", "#fff"], lost: ["#f2f4f7", "#6b7486"], nurture: ["#fbe9e2", "#9a3c1e"] };
export function StagePill({ stage }: { stage: LeadStage }) { const [bg, color] = STAGE_COLORS[stage]; return <span className="status-pill" style={{ padding: "5px 10px", background: bg, color }}>{LEAD_STAGE_LABELS[stage]}</span>; }
export function Stat({ label, value, delta, deltaColor = "#6b7486" }: { label: string; value: string | number; delta?: string; deltaColor?: string }) {
  return <div className="stat"><span style={{ fontSize: 12, color: "#6b7486", fontWeight: 500 }}>{label}</span><b>{value}</b>{delta && <span style={{ fontSize: 12, color: deltaColor, fontWeight: 600 }}>{delta}</span>}</div>;
}
export function Card({ title, sub, action, children, style }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="admin-card" style={style}>
      {(title || action) && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{title && <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>}{sub && <span style={{ fontSize: 12, color: "#6b7486" }}>{sub}</span>}</div>{action}</div>}
      {children}
    </div>
  );
}
export function Avatar({ name, size = 34, dark }: { name: string; size?: number; dark?: boolean }) {
  const ini = name === "Unassigned" ? "—" : name.split(/\s|&/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span style={{ width: size, height: size, flex: "none", borderRadius: "50%", background: dark ? "#1a2238" : "#e6f3fc", color: dark ? "#fff" : "#1a2238", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.33), fontWeight: 700 }}>{ini}</span>;
}
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { published: ["#dcefe4", "#1f6b3f"], Published: ["#dcefe4", "#1f6b3f"], paid: ["#dcefe4", "#1f6b3f"], connected: ["#dcefe4", "#1f6b3f"], ok: ["#dcefe4", "#1f6b3f"], delivered: ["#dcefe4", "#1f6b3f"], sent: ["#dcefe4", "#1f6b3f"], signed: ["#dcefe4", "#1f6b3f"], pending: ["#fff4d6", "#7a5a00"], Pending: ["#fff4d6", "#7a5a00"], draft: ["#fff4d6", "#7a5a00"], Draft: ["#fff4d6", "#7a5a00"], scheduled: ["#e6f3fc", "#1a2238"], queued: ["#e6f3fc", "#1a2238"], logged: ["#e6f3fc", "#1a2238"], rejected: ["#f2f4f7", "#6b7486"], archived: ["#f2f4f7", "#6b7486"], failed: ["#fbe9e2", "#9a3c1e"], error: ["#fbe9e2", "#9a3c1e"], not_connected: ["#f2f4f7", "#6b7486"], disconnected: ["#f2f4f7", "#6b7486"], planned: ["#f2f4f7", "#6b7486"], active: ["#e6f3fc", "#1a2238"], closed: ["#f2f4f7", "#6b7486"], void: ["#f2f4f7", "#6b7486"], done: ["#dcefe4", "#1f6b3f"], booked: ["#e6f3fc", "#1a2238"], cancelled: ["#f2f4f7", "#6b7486"], no_show: ["#fbe9e2", "#9a3c1e"] };
  const [bg, color] = map[status] || ["#f2f4f7", "#4b5569"];
  return <span className="status-pill" style={{ background: bg, color }}>{status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</span>;
}
export function Field({ label, children, span }: { label: ReactNode; children: ReactNode; span?: boolean }) {
  return <label className="label label-caps" style={{ gridColumn: span ? "1/-1" : undefined }}>{label}{children}</label>;
}
export function Empty({ children }: { children: ReactNode }) { return <div style={{ padding: 24, textAlign: "center", color: "#8c95a8", fontSize: 13 }}>{children}</div>; }
