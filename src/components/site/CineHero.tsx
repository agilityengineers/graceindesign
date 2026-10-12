"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Play } from "@/components/ui/Icons";
import { useConsult } from "./ConsultContext";

export type Scene = { name: string; word: string; line?: string; img: string; href?: string };
type Props = { kicker: string; kickerHref?: string; lead: string; tail: string; scenes: Scene[]; scenesLabel: string; cta: string; ctaHref?: string; ctaSource?: string; secondary?: string; secondaryHref?: string; secondaryOnClick?: () => void; secondaryPlay?: boolean; sub?: string; height?: 760 | 720; slideSeconds?: number; hoverSelects?: boolean; wordOnly?: boolean; wordMinWidth?: number; children?: ReactNode };

export default function CineHero(p: Props) {
  const dur = (p.slideSeconds ?? 5) * 1000;
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const reduced = useRef(false);
  const { open } = useConsult();
  const n = Math.max(1, p.scenes.length);
  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || n < 2) return;
    const step = 100;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setT((prev) => { const nt = prev + step; if (nt >= dur) { setI((x) => (x + 1) % n); return 0; } return nt; });
    }, step);
    return () => clearInterval(timer);
  }, [dur, n]);
  const cur = p.scenes[i] || p.scenes[0];
  const prog = t / dur;
  const pick = (k: number) => { setI(k); setT(0); };
  const scrollTo = (href?: string) => (e: React.MouseEvent) => { if (href?.startsWith("#")) { const el = document.querySelector(href); if (el) { e.preventDefault(); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" }); } } };
  return (
    <section className={`hero-cine${p.height === 720 ? " hero-cine-720" : ""}`} style={{ ["--kb-dur" as string]: `${dur / 1000 + 1.5}s` }}>
      <div style={{ position: "absolute", inset: 0 }}>
        {p.scenes.map((s, k) => <img key={k} src={s.img} alt={s.name} className={`scene-img${k === i ? " is-on" : ""}`} loading={k === 0 ? "eager" : "lazy"} />)}
      </div>
      <div className="scrim-x" /><div className="scrim-y" />
      <div className="hero-grid gx">
        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 780 }}>
          {p.kickerHref ? <Link href={p.kickerHref} className="eyebrow eyebrow-sky" style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 28, height: 2, background: "#6cb6e6", display: "block" }} />{p.kicker}</Link> : <span className="eyebrow eyebrow-sky" style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 28, height: 2, background: "#6cb6e6", display: "block" }} />{p.kicker}</span>}
          <h1 className="h1 h1-xl" style={{ color: "#fff" }}>
            {p.lead} <span className="word" style={{ minWidth: p.wordMinWidth }}>{cur?.word}<span className="word-bar" style={{ transform: `scaleX(${prog})` }} /></span>
            {!p.wordOnly && <><br />{p.tail}</>}
          </h1>
          {(p.sub || cur?.line) && <p style={{ maxWidth: 600, fontSize: 18, lineHeight: 1.65, color: "#dfe3ea", textWrap: "pretty" }}>{p.sub || cur?.line}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 4, flexWrap: "wrap" }}>
            {p.ctaSource ? <button type="button" className="btn btn-sky btn-lg" onClick={() => open(p.ctaSource)}>{p.cta} <ArrowRight size={18} color="#1a2238" width={2} /></button>
              : <Link href={p.ctaHref || "/contact"} className="btn btn-sky btn-lg" onClick={scrollTo(p.ctaHref)}>{p.cta} <ArrowRight size={18} color="#1a2238" width={2} /></Link>}
            {p.secondary && (p.secondaryPlay
              ? <a href={p.secondaryHref} onClick={scrollTo(p.secondaryHref)} style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600, color: "#fff" }}><span style={{ position: "relative", width: 38, height: 38, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="pulse-ring" /><Play /></span>{p.secondary}</a>
              : <Link href={p.secondaryHref || "/services"} style={{ fontSize: 15, fontWeight: 600, color: "#fff", borderBottom: "1.5px solid rgba(255,255,255,.6)", paddingBottom: 2 }}>{p.secondary}</Link>)}
          </div>
        </div>
        <div className="hero-rail">
          <span className="eyebrow-sm eyebrow" style={{ color: "#c6cbd6", marginBottom: 8 }}>{p.scenesLabel}</span>
          {p.scenes.map((s, k) => {
            const inner = (<>
              <span className="display" style={{ fontSize: 20, color: "#6cb6e6", width: 28 }}>{String(k + 1).padStart(2, "0")}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span><span className="rail-bar"><span style={{ width: k === i ? `${Math.round(prog * 100)}%` : k < i ? "100%" : "0%" }} /></span></span>
            </>);
            const cls = `rail-item${k === i ? " is-on" : ""}`;
            if (s.href && p.hoverSelects) return <Link key={k} href={s.href} className={cls} onMouseEnter={() => pick(k)} onFocus={() => pick(k)} onClick={scrollTo(s.href)}>{inner}</Link>;
            return <button key={k} type="button" className={cls} style={{ textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={(e) => { pick(k); if (s.href?.startsWith("#")) scrollTo(s.href)(e); }} onMouseEnter={() => p.hoverSelects && pick(k)}>{inner}</button>;
          })}
        </div>
      </div>
      <div className="scroll-hint"><span style={{ width: 1, height: 36, background: "rgba(255,255,255,.3)" }} />Scroll to explore</div>
      {p.children}
    </section>
  );
}

export function Marquee({ words }: { words: string[] }) {
  const seq = [...words, ...words];
  return <div className="marquee" aria-hidden="true"><div className="marquee-track">{seq.map((w, k) => <span key={k} className="marquee-item">{w}</span>)}</div></div>;
}
