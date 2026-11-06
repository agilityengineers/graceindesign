"use client";
import { useState } from "react";

export type PartnerCard = { id: number; name: string; category: string; categoryLabel: string; serviceType: string | null; relationship: string; relationshipLabel: string; serviceArea: string | null; description: string; websiteUrl: string | null; logo: string | null; imageKind: "logo" | "photo" };

const Pin = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>;
const ImageIcon = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>;
const ExternalIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>;

/** AIP Partners directory: category filter pills over a card grid (cards follow the approved mock-up: image tile beside the name, description and website link below). */
export default function PartnerDirectory({ categories, partners }: { categories: { key: string; label: string }[]; partners: PartnerCard[] }) {
  const [f, setF] = useState("all");
  const list = partners.filter((p) => f === "all" || p.category === f);
  const pills = [{ key: "all", label: "All" }, ...categories];
  return (<>
    {categories.length > 1 && (
      <div role="group" aria-label="Filter partners by category" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {pills.map((c) => <button key={c.key} type="button" className={`pill${c.key === f ? " is-on" : ""}`} onClick={() => setF(c.key)} aria-pressed={c.key === f}>{c.label}</button>)}
      </div>)}
    <div className="g2" style={{ gap: 20 }}>
      {list.map((p) => (
        <article key={p.id} style={{ display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", overflow: "hidden" }}>
          {/* Logo or photo in a fixed-size tile beside the name, so every listing lines up (see the approved mock-up). */}
          <div className="partner-card-head" style={{ display: "grid", gridTemplateColumns: "112px minmax(0, 1fr)", gap: 20, alignItems: "center", padding: 24 }}>
            <div style={{ width: 112, height: 112, borderRadius: 12, border: "1px solid #eef0f4", background: "#f7f8fa", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", color: "#8c95a8" }}>
              {p.logo
                ? <img src={p.logo} alt={`${p.name} ${p.imageKind === "photo" ? "photo" : "logo"}`} loading="lazy" style={p.imageKind === "photo" ? { width: "100%", height: "100%", objectFit: "cover" } : { maxWidth: "84%", maxHeight: "84%", objectFit: "contain" }} />
                : <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11 }}><ImageIcon />Partner logo</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".12em" }}>{p.categoryLabel}</span><span className="tag" style={{ fontSize: 10, flex: "none", ...(p.relationship === "collaborator" ? { background: "#e6f3fc", color: "#1a2238" } : {}) }}>{p.relationshipLabel}</span></div>
              <h3 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, margin: 0 }}>{p.name}</h3>
              {p.serviceType && <span style={{ fontSize: 14, lineHeight: 1.5, color: "#4b5569" }}>{p.serviceType}</span>}
              {p.serviceArea && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6b7486" }}><Pin /><span className="sr-only">Service area: </span>{p.serviceArea}</span>}
            </div>
          </div>
          {(p.description || p.websiteUrl) && <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 24px 22px", borderTop: "1px solid #eef0f4", flex: 1 }}>
            {p.description && <p style={{ fontSize: 14, lineHeight: 1.65, color: "#4b5569", margin: 0, flex: 1 }}>{p.description}</p>}
            {p.websiteUrl && <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" className="tap" style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: "#3f9ad9" }}>Visit Partner Website <ExternalIcon /><span className="sr-only"> {p.name} (opens in a new tab)</span></a>}
          </div>}
        </article>))}
    </div>
  </>);
}
