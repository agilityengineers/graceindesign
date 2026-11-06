"use client";
import { useState } from "react";

export type PartnerCard = { id: number; name: string; category: string; categoryLabel: string; serviceType: string | null; relationship: string; relationshipLabel: string; serviceArea: string | null; description: string; websiteUrl: string | null; logo: string | null };

/** AIP Partners directory: category filter pills over a card grid (same look as the Caribbean Connection directory). */
export default function PartnerDirectory({ categories, partners }: { categories: { key: string; label: string }[]; partners: PartnerCard[] }) {
  const [f, setF] = useState("all");
  const list = partners.filter((p) => f === "all" || p.category === f);
  const pills = [{ key: "all", label: "All" }, ...categories];
  return (<>
    {categories.length > 1 && (
      <div role="group" aria-label="Filter partners by category" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pills.map((c) => <button key={c.key} type="button" className={`pill${c.key === f ? " is-on" : ""}`} onClick={() => setF(c.key)} aria-pressed={c.key === f}>{c.label}</button>)}
      </div>)}
    <div className="g3" style={{ gap: 20 }}>
      {list.map((p) => (
        <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff" }}>
          {p.logo && <div style={{ height: 56, display: "flex", alignItems: "center" }}><img src={p.logo} alt={`${p.name} logo`} style={{ maxHeight: 56, maxWidth: 160, objectFit: "contain" }} loading="lazy" /></div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{p.categoryLabel}</span><span className="tag" style={{ fontSize: 10, flex: "none", ...(p.relationship === "collaborator" ? { background: "#e6f3fc", color: "#1a2238" } : {}) }}>{p.relationshipLabel}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</span>{p.serviceType && <span style={{ fontSize: 13, color: "#4b5569", fontWeight: 500 }}>{p.serviceType}</span>}</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#6b7486", flex: 1 }}>{p.description}</p>
          {(p.serviceArea || p.websiteUrl) && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 8, borderTop: "1px solid #eef0f4" }}><span style={{ fontSize: 12, color: "#8c95a8" }}>{p.serviceArea ? <><span className="sr-only">Service area: </span>{p.serviceArea}</> : null}</span>{p.websiteUrl && <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" className="tap" style={{ fontSize: 12, fontWeight: 600, color: "#3f9ad9" }}>Visit website →<span className="sr-only"> {p.name} (opens in a new tab)</span></a>}</div>}
        </div>))}
    </div>
  </>);
}
