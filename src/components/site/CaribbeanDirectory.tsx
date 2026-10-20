"use client";
import { useState } from "react";

type R = { id: number; name: string; category: string; where: string; type: string; description: string; url: string };
export default function CaribbeanDirectory({ eyebrow, title, categories, resources }: { eyebrow: string; title: string; categories: string[]; resources: R[] }) {
  const [f, setF] = useState("All");
  const list = resources.filter((r) => f === "All" || r.category === f || (f === "Housing" && r.category.startsWith("Housing")));
  return (<>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}><span className="eyebrow">{eyebrow}</span><h2 className="h2">{title}</h2></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{categories.map((c) => <button key={c} type="button" className={`pill${c === f ? " is-on" : ""}`} onClick={() => setF(c)} aria-pressed={c === f}>{c}</button>)}</div>
    </div>
    <div className="g3" style={{ gap: 20 }}>
      {list.map((d) => (
        <div key={d.id} className="reveal is-in" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{d.category}</span><span className="tag" style={{ fontSize: 10 }}>{d.where}</span></div>
          <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{d.name}</span>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#6b7486", flex: 1 }}>{d.description}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #eef0f4" }}><span style={{ fontSize: 12, color: "#8c95a8" }}>{d.type}</span><a href={d.url || "#directory"} target={d.url ? "_blank" : undefined} rel="noreferrer" className="tap" style={{ fontSize: 12, fontWeight: 600, color: "#3f9ad9" }}>Visit →</a></div>
        </div>))}
      {!list.length && <p style={{ color: "#6b7486", fontSize: 14 }}>No listings in this category yet — suggest one below.</p>}
    </div>
  </>);
}
