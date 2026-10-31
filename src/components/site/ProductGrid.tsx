"use client";
import { useMemo, useState } from "react";
import { Heart, ArrowUpRight } from "@/components/ui/Icons";
import { amazonCartUrl } from "@/lib/retailers";

export type GridProduct = { id: number; title: string; description: string; category: string; price: string; reviews: string; synced: boolean; type: string; tag: string; img: string; url: string; asin: string | null; cartUrl: string; retailer: string; retailerLabel: string };
export type GridShop = { tag: string; marketplace: string; cartButtons: boolean };

const placeholder = (label: string) => `/api/placeholder?label=${encodeURIComponent(label)}`;
const hasPrice = (p: string) => !!p && p !== "$—" && p !== "—";

/** Filterable product grid. Categories come from the products themselves (the block's list only sets their order), so a filter never points at an empty shelf. */
export default function ProductGrid({ title, categories, products, shopUrl, disclosure, shop }: { title: string; categories?: string[]; products: GridProduct[]; shopUrl: string; disclosure?: string; shop?: GridShop }) {
  const cats = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const c of [...(categories || []), ...products.map((p) => p.category)]) {
      if (!c || c === "All" || seen.has(c) || !products.some((p) => p.category === c)) continue;
      seen.add(c); out.push(c);
    }
    return out;
  }, [categories, products]);
  const [f, setF] = useState("All");
  const active = cats.includes(f) ? f : "All";
  const list = products.filter((p) => active === "All" || p.category === active);
  const asins = list.map((p) => p.asin).filter((a): a is string => !!a);
  const cartAll = shop?.tag && shop.cartButtons && asins.length > 1 ? amazonCartUrl(asins, shop.tag, shop.marketplace) : "";
  if (products.length === 0) return (
    <section className="gx" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 className="h2" style={{ fontSize: 40 }}>{title}</h2>
      <p style={{ maxWidth: 560, fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>New picks are being added. In the meantime, browse everything currently available in our Etsy shop.</p>
      <a href={shopUrl} target="_blank" rel="noreferrer" className="btn btn-navy" style={{ alignSelf: "flex-start" }}>Visit our Etsy shop <ArrowUpRight size={12} /></a>
    </section>
  );
  return (
    <section className="gx reveal is-in" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
        <h2 className="h2" style={{ fontSize: 40 }}>{title}</h2>
        {cartAll && <a href={cartAll} target="_blank" rel="noreferrer sponsored" className="btn btn-outline" style={{ height: 44, fontSize: 13 }}>Add all {asins.length} to your Amazon cart</a>}
      </div>
      {cats.length > 1 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["All", ...cats].map((c) => <button key={c} type="button" className={`pill${c === active ? " is-on" : ""}`} style={{ height: 40, padding: "0 18px", fontSize: 13, border: "1.5px solid", borderColor: c === active ? "#1a2238" : "#e3e6ec" }} onClick={() => setF(c)} aria-pressed={c === active}>{c}</button>)}
        </div>
      )}
      <div className="g4" style={{ gap: 24 }}>
        {list.length === 0 && <p style={{ gridColumn: "1/-1", fontSize: 14, color: "#6b7486" }}>Nothing in this category yet.</p>}
        {list.map((p) => { const amazon = p.retailer === "amazon"; const rel = amazon ? "noreferrer sponsored" : "noreferrer"; return (
          <article key={p.id} className="card-hover" style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e9ecf1", color: "#1a2238" }}>
            <a href={p.url} target="_blank" rel={rel} style={{ position: "relative", display: "block", aspectRatio: "1/1", background: "#f7f8fa" }} aria-label={`${p.title} on ${p.retailerLabel}`}>
              <img src={p.img || placeholder(p.title)} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: amazon ? "contain" : "cover", padding: amazon ? 18 : 0 }} loading="lazy" />
              {p.tag && <span style={{ position: "absolute", top: 12, left: 12, padding: "5px 10px", borderRadius: 999, background: "#fff", fontSize: 11, fontWeight: 600 }}>{p.tag}</span>}
              <span style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Heart /></span>
            </a>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px 18px", flex: 1 }}>
              <a href={p.url} target="_blank" rel={rel} style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</a>
              {p.description && <span style={{ fontSize: 13, lineHeight: 1.55, color: "#6b7486", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</span>}
              {p.synced && p.reviews && p.reviews !== "(0)" && <span style={{ fontSize: 12, color: "#6b7486" }}>{p.reviews.replace(/[()]/g, "")} reviews on {p.retailerLabel}</span>}
              {(hasPrice(p.price) || p.type) && <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 2 }}><span style={{ fontSize: 18, fontWeight: 700 }}>{hasPrice(p.price) ? p.price : ""}</span><span style={{ fontSize: 11, fontWeight: 600, color: "#3f9ad9", textAlign: "right" }}>{p.type}</span></div>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 }}>
                {p.cartUrl
                  ? <><a href={p.cartUrl} target="_blank" rel={rel} className="btn btn-navy" style={{ flex: 1, height: 40, padding: "0 14px", fontSize: 13 }}>Add to Amazon cart</a><a href={p.url} target="_blank" rel={rel} className="btn btn-outline" style={{ height: 40, padding: "0 14px", fontSize: 13 }} aria-label={`View on ${p.retailerLabel}`}>View <ArrowUpRight size={12} /></a></>
                  : <a href={p.url} target="_blank" rel={rel} className="btn btn-outline" style={{ flex: 1, height: 40, fontSize: 13 }}>View on {p.retailerLabel} <ArrowUpRight size={12} /></a>}
              </div>
            </div>
          </article>); })}
      </div>
      {disclosure && <p style={{ maxWidth: 760, fontSize: 12.5, lineHeight: 1.65, color: "#8c95a8" }}>{disclosure}</p>}
    </section>
  );
}
