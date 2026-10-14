"use client";
import { useState } from "react";
import { Heart, ArrowUpRight } from "@/components/ui/Icons";

type P = { id: number; title: string; category: string; price: string; reviews: string; synced: boolean; type: string; tag: string; img: string; url: string };
export default function ProductGrid({ title, categories, products, shopUrl }: { title: string; categories: string[]; products: P[]; shopUrl: string }) {
  const [f, setF] = useState("All");
  const list = products.filter((p) => f === "All" || p.category === f);
  if (products.length === 0) return (
    <section className="gx" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 className="h2" style={{ fontSize: 40 }}>{title}</h2>
      <p style={{ maxWidth: 560, fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>New listings are being added. In the meantime, browse everything currently available in our Etsy shop.</p>
      <a href={shopUrl} target="_blank" rel="noreferrer" className="btn btn-navy" style={{ alignSelf: "flex-start" }}>Visit our Etsy shop <ArrowUpRight size={12} /></a>
    </section>
  );
  return (
    <section className="gx reveal is-in" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 32 }}>
      <h2 className="h2" style={{ fontSize: 40 }}>{title}</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{categories.map((c) => <button key={c} type="button" className={`pill${c === f ? " is-on" : ""}`} style={{ height: 40, padding: "0 18px", fontSize: 13, border: "1.5px solid", borderColor: c === f ? "#1a2238" : "#e3e6ec" }} onClick={() => setF(c)} aria-pressed={c === f}>{c}</button>)}</div>
      <div className="g4" style={{ gap: 24 }}>
        {list.length === 0 && <p style={{ gridColumn: "1/-1", fontSize: 14, color: "#6b7486" }}>Nothing in this category yet.</p>}
        {list.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="card-hover" style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e9ecf1", color: "#1a2238" }}>
            <div style={{ position: "relative", aspectRatio: "1/1" }}><img src={p.img} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />{p.tag && <span style={{ position: "absolute", top: 12, left: 12, padding: "5px 10px", borderRadius: 999, background: "#fff", fontSize: 11, fontWeight: 600 }}>{p.tag}</span>}<span style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Heart /></span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px 18px" }}>
              <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</span>
              {p.synced && p.reviews && p.reviews !== "(0)" && <span style={{ fontSize: 12, color: "#6b7486" }}>{p.reviews.replace(/[()]/g, "")} reviews on Etsy</span>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 18, fontWeight: 700 }}>{p.price}</span><span style={{ fontSize: 11, fontWeight: 600, color: "#3f9ad9" }}>{p.type}</span></div>
              <span className="btn btn-outline" style={{ marginTop: 8, height: 40, fontSize: 13 }}>View on Etsy <ArrowUpRight size={12} /></span>
            </div>
          </a>))}
      </div>
    </section>
  );
}
