"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@/components/ui/Icons";

/** Auto-advance 4s, pause on hover, prev/next, dots, visible-count by width. */
export default function Carousel({ eyebrow, title, cardWidth, gap = 24, children, count }: { eyebrow: string; title: string; cardWidth: number; gap?: number; children: ReactNode[]; count: number }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(3);
  const wrap = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(cardWidth);
  useEffect(() => {
    const calc = () => { const w = wrap.current?.clientWidth || 1296; const small = w < 720; const c = small ? w : cardWidth; setCw(c); setVisible(Math.max(1, Math.floor((w + gap) / (c + gap)))); };
    calc(); window.addEventListener("resize", calc); return () => window.removeEventListener("resize", calc);
  }, [cardWidth, gap]);
  const max = Math.max(0, count - visible);
  const c = Math.min(idx, max);
  const step = (d: number) => setIdx((s) => ((Math.min(s, max) + d) % (max + 1) + (max + 1)) % (max + 1));
  useEffect(() => { const t = setInterval(() => { if (!paused && !document.hidden) step(1); }, 4000); return () => clearInterval(t); }, [paused, max]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section style={{ paddingTop: 72, display: "flex", flexDirection: "column", gap: 28, overflow: "hidden" }}>
      <div className="gx" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="eyebrow">{eyebrow}</span><h2 className="h2" style={{ fontSize: 40 }}>{title}</h2></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#6b7486", marginRight: 8 }}>{c + 1} / {max + 1}</span>
          <button type="button" aria-label="Previous" onClick={() => step(-1)} style={{ width: 46, height: 46, borderRadius: "50%", border: "1.5px solid #e3e6ec", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a2238", cursor: "pointer" }}><ArrowLeft /></button>
          <button type="button" aria-label="Next" onClick={() => step(1)} style={{ width: 46, height: 46, borderRadius: "50%", background: "#1a2238", border: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}><ArrowRight size={16} color="#fff" /></button>
        </div>
      </div>
      <div ref={wrap} className="gx" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", gap, transform: `translateX(${-(c * (cw + gap))}px)`, transition: "transform .6s cubic-bezier(.22,.61,.36,1)" }}>
          {children.map((ch, k) => <div key={k} style={{ flex: "none", width: cw }}>{ch}</div>)}
        </div>
      </div>
      <div className="gx" style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: max + 1 }, (_, k) => <button key={k} type="button" aria-label={`Go to ${k + 1}`} onClick={() => setIdx(k)} style={{ height: 4, width: k === c ? 28 : 10, borderRadius: 2, background: k === c ? "#1a2238" : "#dfe3ea", border: 0, padding: 0, transition: "all .4s", cursor: "pointer" }} />)}
      </div>
    </section>
  );
}
