"use client";
import { useState } from "react";
import { Heart, ArrowUpRight } from "@/components/ui/Icons";

type P = { id: number; title: string; category: string; price: string; reviews: string; type: string; tag: string; img: string; url: string };
export default function ProductGrid({ title, categories, products }: { title: string; categories: string[]; products: P[] }) {
  const [f, setF] = useState("All");
  const list = products.filter((p) => f === "All" || p.category === f);
  return (
    <section className="gx reveal is-in" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 32 }}>
      <h2 className="h2" style={{ fontSize: 40 }}>{title}</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{categories.map((c) => <button key={c} type="button" className={`pill${c === f ? " is-on" : ""}`} style={{ height: 40, padding: "0 18px", fontSize: 13, border: "1.5px solid", borderColor: c === f ? "#1a2238" : "#e3e6ec" }} onClick={() => setF(c)} aria-pressed={c === f}>{c}</button>)}</div>
      <div className="g4" style={{ gap: 24 }}>
        {list.map((p) => (
          <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="card-hover" style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e9ecf1", color: "#1a2238" }}>
            <div style={{ position: "relative", aspectRatio: "1/1" }}><img src={p.img} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />{p.tag && <span style={{ position: "absolute", top: 12, left: 12, padding: "5px 10px", borderRadius: 999, background: "#fff", fontSize: 11, fontWeight: 600 }}>{p.tag}</span>}<span style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Heart /></span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px 18px" }}>
              <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7486" }}><span style={{ color: "#f0a500", letterSpacing: -1 }}>★★★★★</span><span>{p.reviews}</span></div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 18, fontWeight: 700 }}>{p.price}</span><span style={{ fontSize: 11, fontWeight: 600, color: "#3f9ad9" }}>{p.type}</span></div>
              <span className="btn btn-outline" style={{ marginTop: 8, height: 40, fontSize: 13 }}>View on Etsy <ArrowUpRight size={12} /></span>
            </div>
          </a>))}
      </div>
    </section>
  );
}
