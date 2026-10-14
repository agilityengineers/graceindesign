"use client";
import { useRef, useState } from "react";
import { Compare } from "@/components/ui/Icons";

export default function BeforeAfter({ before, after, title, note, beforeAlt, afterAlt }: { before: string; after: string; title: string; note?: string; beforeAlt?: string; afterAlt?: string }) {
  const [pct, setPct] = useState(50);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientX: number) => { const el = ref.current; if (!el) return; const b = el.getBoundingClientRect(); setPct(Math.max(3, Math.min(97, ((clientX - b.left) / b.width) * 100))); };
  return (
    <section id="before-after" className="gx" style={{ paddingBottom: 104, display: "flex", flexDirection: "column", gap: 32 }}>
      <div className="g2 g2-stack-sm" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><span className="eyebrow">Drag to compare</span><h2 className="h2" style={{ fontSize: 44 }}>{title}</h2></div>
        {note && <span style={{ fontSize: 14, color: "#6b7486", maxWidth: 360, lineHeight: 1.6, justifySelf: "end" }}>{note}</span>}
      </div>
      <div ref={ref} className="ba" role="slider" aria-label="Before and after comparison" aria-valuenow={Math.round(pct)} aria-valuemin={3} aria-valuemax={97} tabIndex={0}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); set(e.clientX); }}
        onPointerMove={(e) => { if (drag) set(e.clientX); }} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setPct((p) => Math.max(3, p - 3)); if (e.key === "ArrowRight") setPct((p) => Math.min(97, p + 3)); }}>
        <img src={after} alt={afterAlt ? `After: ${afterAlt}` : "After"} draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, overflow: "hidden" }}><img src={before} alt={beforeAlt ? `Before: ${beforeAlt}` : "Before"} draggable={false} style={{ position: "absolute", top: 0, left: 0, width: ref.current?.clientWidth || 1296, height: "100%", objectFit: "cover", filter: "saturate(.75)" }} /></div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, background: "#fff", transform: "translateX(-1px)", boxShadow: "0 0 24px rgba(0,0,0,.3)" }}>
          <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 56, height: 56, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(26,34,56,.3)" }}><Compare /></span>
        </div>
        <span style={{ position: "absolute", top: 20, left: 20, padding: "8px 14px", borderRadius: 999, background: "rgba(26,34,56,.8)", color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>Before</span>
        <span style={{ position: "absolute", top: 20, right: 20, padding: "8px 14px", borderRadius: 999, background: "#6cb6e6", color: "#1a2238", fontSize: 12, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>After</span>
      </div>
    </section>
  );
}
