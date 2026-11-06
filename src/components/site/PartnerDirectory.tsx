"use client";
import { useEffect, useState } from "react";
import { partnerInitials, partnerUrlLabel, type PartnerCard } from "@/lib/partners";

/**
 * The AIP Partners directory: category navigation (pills with counts) over cards with a photo, name, specialty,
 * description and website. "All" shows every category under its own heading; a pill narrows to one. The choice is
 * kept in the URL hash (#category-slug) so a filtered view can be linked to and survives the back button.
 */
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function PartnerDirectory({ eyebrow, title, note, empty, groups }: { eyebrow?: string; title?: string; note?: string; empty?: string; groups: [string, PartnerCard[]][] }) {
  const [cat, setCat] = useState("All");
  useEffect(() => {
    const fromHash = () => { const h = decodeURIComponent(window.location.hash.slice(1)); const hit = groups.find(([c]) => slug(c) === h); setCat(hit ? hit[0] : "All"); };
    fromHash(); window.addEventListener("hashchange", fromHash); return () => window.removeEventListener("hashchange", fromHash);
  }, [groups]);
  const pick = (c: string) => { setCat(c); history.replaceState(null, "", c === "All" ? `${window.location.pathname}${window.location.search}#directory` : `#${slug(c)}`); };
  const total = groups.reduce((n, [, l]) => n + l.length, 0);
  const shown = cat === "All" ? groups : groups.filter(([c]) => c === cat);
  return (<>
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {(eyebrow || title) && <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2 className="h2">{title}</h2>}</div>}
      {groups.length > 1 && <nav aria-label="Partner categories" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["All", total] as const, ...groups.map(([c, l]) => [c, l.length] as const)].map(([c, n]) => <button key={c} type="button" className={`pill${c === cat ? " is-on" : ""}`} onClick={() => pick(c)} aria-pressed={c === cat}>{c}<span style={{ opacity: .6, fontWeight: 500 }}>{n}</span></button>)}
      </nav>}
    </div>
    {!total && <p style={{ color: "#6b7486", fontSize: 15, lineHeight: 1.6 }}>{empty || "Listings are on the way."}</p>}
    {shown.map(([c, list]) => (
      <div key={c} id={slug(c)} style={{ display: "flex", flexDirection: "column", gap: 20, scrollMarginTop: 24 }}>
        {(cat === "All" && groups.length > 1) && <h3 className="display" style={{ fontSize: 26, fontWeight: 500, borderBottom: "1px solid #e9ecf1", paddingBottom: 10 }}>{c}</h3>}
        <div className="g3" style={{ gap: 20 }}>
          {list.map((p) => (
            <article key={p.id} style={{ display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", overflow: "hidden" }}>
              <div style={{ position: "relative", aspectRatio: "16 / 10", background: "#f2f5f9" }}>
                {p.image
                  ? <img src={p.image} alt={p.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display, serif)", fontSize: 44, color: "#9aa6bb", letterSpacing: ".04em" }}>{partnerInitials(p.name)}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 24, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{p.category}</span>{p.location && <span className="tag" style={{ fontSize: 10 }}>{p.location}</span>}</div>
                <h4 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, margin: 0 }}>{p.name}</h4>
                {p.specialty && <span style={{ fontSize: 13, fontWeight: 600, color: "#3f9ad9" }}>{p.specialty}</span>}
                {p.description && <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7486", flex: 1, margin: 0 }}>{p.description}</p>}
                {p.url && <div style={{ paddingTop: 10, marginTop: "auto", borderTop: "1px solid #eef0f4" }}><a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="tap" style={{ fontSize: 13, fontWeight: 600, color: "#1a2238" }} aria-label={`Visit ${p.name}'s website (opens in a new tab)`}>{partnerUrlLabel(p.url) || "Visit website"} ↗</a></div>}
              </div>
            </article>))}
        </div>
      </div>))}
    {note && total > 0 && <p style={{ fontSize: 13, lineHeight: 1.65, color: "#6b7486", maxWidth: 860, padding: "18px 22px", borderRadius: 14, background: "#f7f8fa", border: "1px solid #e9ecf1" }}>{note}</p>}
  </>);
}
