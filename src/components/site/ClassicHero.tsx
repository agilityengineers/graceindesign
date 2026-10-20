import Link from "next/link";
import { ArrowRight, ArrowLeft, Check } from "@/components/ui/Icons";
import { ConsultButton } from "./ConsultContext";

export function HomeClassicHero({ kicker, title, sub, cta, source, secondary, secondaryHref, img, imgAlt, stats, badgeTitle, badgeSub }: { kicker: string; title: string; sub: string; cta: string; source: string; secondary: string; secondaryHref: string; img: string; imgAlt?: string; stats: [string, string][]; badgeTitle: string; badgeSub: string }) {
  return (
    <section className="hero-classic" style={{ position: "relative", minHeight: 680 }}>
      <div className="hero-copy" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "96px 64px 96px var(--gutter)", gap: 28, minWidth: 0 }}>
        <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 28, height: 2, background: "#6cb6e6", display: "block" }} />{kicker}</div>
        <h1 className="h1" style={{ fontSize: 68, lineHeight: 1.04 }}>{title}</h1>
        <p className="body-lg" style={{ maxWidth: 520, lineHeight: 1.65 }}>{sub}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
          <ConsultButton sourceKey={source} className="btn btn-sky btn-md" style={{ letterSpacing: ".02em" }}>{cta} <ArrowRight size={18} color="#1a2238" width={2} /></ConsultButton>
          <Link href={secondaryHref} style={{ fontSize: 15, fontWeight: 600, color: "#1a2238", borderBottom: "1.5px solid #1a2238", paddingBottom: 2 }}>{secondary}</Link>
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 28, paddingTop: 28, borderTop: "1px solid #e3e6ec", flexWrap: "wrap" }}>
          {stats.map(([big, small]) => <div key={big} style={{ display: "flex", flexDirection: "column", gap: 4 }}><span className="display" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1 }}>{big}</span><span style={{ fontSize: 12, color: "#6b7486", letterSpacing: ".04em" }}>{small}</span></div>)}
        </div>
      </div>
      <div className="hero-photo-wrap" style={{ position: "relative", minWidth: 0, minHeight: 0 }}>
        <div className="hero-photo"><img src={img} alt={imgAlt || "Grace In Design project"} /></div>
        <div style={{ position: "absolute", left: -56, bottom: 88, display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 18px 44px rgba(26,34,56,.14)", pointerEvents: "none" }} className="hero-badge">
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={22} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{badgeTitle}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{badgeSub}</span></div>
        </div>
      </div>
    </section>
  );
}

export function ServiceClassicHero({ kicker, kickerHref, title, sub, cta, source, img, imgAlt }: { kicker: string; kickerHref: string; title: string; sub: string; cta: string; source: string; img: string; imgAlt?: string }) {
  return (
    <section className="hero-classic">
      <div className="hero-copy" style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "88px 64px 88px var(--gutter)", gap: 26, minWidth: 0 }}>
        <Link href={kickerHref} className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}><ArrowLeft size={12} />{kicker}</Link>
        <h1 className="h1">{title}</h1>
        <p className="lede" style={{ maxWidth: 540 }}>{sub}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 6, flexWrap: "wrap" }}>
          <ConsultButton sourceKey={source} className="btn btn-sky btn-md">{cta} <ArrowRight size={18} color="#1a2238" width={2} /></ConsultButton>
          <span style={{ fontSize: 13, color: "#6b7486" }}>Free · No obligation · Reply within one business day</span>
        </div>
      </div>
      <div className="hero-photo-wrap" style={{ position: "relative", minWidth: 0, minHeight: 0 }}><div className="hero-photo"><img src={img} alt={imgAlt || title} /></div></div>
    </section>
  );
}
