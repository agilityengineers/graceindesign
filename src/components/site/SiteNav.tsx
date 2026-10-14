"use client";
import Link from "next/link";
import { useState } from "react";
import { Phone, Mail, Chevron, ArrowRight } from "@/components/ui/Icons";
import { useConsult } from "./ConsultContext";

export type NavService = { slug: string; title: string; href: string; children: { slug: string; title: string; href: string }[] };
export type NavActive = "home" | "about" | "services" | "hbd" | "caribbean" | "news" | "none";

export default function SiteNav({ label, active, sourceKey, phone, email, services }: { label: string; active: NavActive; sourceKey: string; phone: string; email: string; services: NavService[] }) {
  const { open } = useConsult();
  const [mobile, setMobile] = useState(false);
  const [dd, setDd] = useState<"svc" | "hbd" | null>(null);
  const cls = (k: NavActive) => `nav-link${active === k ? " is-active" : ""}`;
  const hhr = [
    ["AIP Products", "Aging In Place essentials from our shop", "/healthy-home-resources/aip-products"],
    ["WELLness Resources", "Guides for healthier living spaces", "/healthy-home-resources/wellness"],
    ["Home Health Series", "Articles & videos on home wellness", "/healthy-home-resources/home-health-series"],
    ["AIP Partners", "Join our Aging In Place network", "/healthy-home-resources/aip-partners"],
  ];
  return (
    <div style={{ position: "relative", zIndex: 50 }}>
      <div className="util-bar gx">
        <div style={{ display: "flex", alignItems: "center", gap: 28, minWidth: 0 }}>
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#c6cbd6", whiteSpace: "nowrap" }}><Phone />{phone}</a>
          <a className="util-email" href={`mailto:${email}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#c6cbd6", whiteSpace: "nowrap" }}><Mail />{email}</a>
          <span className="util-mid" style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6cb6e6", flex: "none" }} />{label}</span>
        </div>
        <button type="button" className="util-cta" onClick={() => open(sourceKey)}>Schedule a Consultation <ArrowRight size={14} color="currentColor" /></button>
      </div>
      <header className="site-header gx">
        <Link href="/" aria-label="Grace In Design home" style={{ display: "block", flex: "none" }}><img src="/assets/logo-dark-transparent.png" alt="Grace In Design" style={{ height: 60, width: "auto", display: "block" }} className="nav-logo" /></Link>
        <nav className="site-nav" aria-label="Main">
          <Link href="/" className={cls("home")}>Home</Link>
          <Link href="/about" className={cls("about")}>About</Link>
          <div className={`nav-dd${dd === "svc" ? " is-open" : ""}`} onMouseEnter={() => setDd("svc")} onMouseLeave={() => setDd(null)}>
            <Link href="/services" className={cls("services")} aria-haspopup="true" aria-expanded={dd === "svc"} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setDd("svc"); } }}>Services <Chevron /></Link>
            <div className="nav-dd-menu" style={{ width: 300 }}>
              <div className="nav-dd-panel">
                <span className="nav-dd-notch" />
                {services.map((s) => (
                  <div key={s.slug}>
                    <Link href={s.href} className="nav-dd-item">{s.title}</Link>
                    {s.children.map((c) => <Link key={c.slug} href={c.href} className="nav-dd-sub">{c.title}</Link>)}
                  </div>
                ))}
                <Link href="/services" className="nav-dd-all">View all services →</Link>
              </div>
            </div>
          </div>
          <div className={`nav-dd${dd === "hbd" ? " is-open" : ""}`} onMouseEnter={() => setDd("hbd")} onMouseLeave={() => setDd(null)}>
            <Link href="/healthy-home-resources" className={cls("hbd")} style={{ color: "#1a2238", fontWeight: 600 }} aria-haspopup="true" aria-expanded={dd === "hbd"} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setDd("hbd"); } }}>Healthy Home Resources <Chevron color="#1a2238" /></Link>
            <div className="nav-dd-menu" style={{ width: 272 }}>
              <div className="nav-dd-panel">
                <span className="nav-dd-notch" />
                {hhr.map(([t, d, h]) => <Link key={h} href={h} className="nav-dd-rich"><b>{t}</b><span>{d}</span></Link>)}
              </div>
            </div>
          </div>
          <Link href="/caribbean-connection" className={cls("caribbean")}>Caribbean Connection</Link>
          <Link href="/news" className={cls("news")}>News &amp; Insights</Link>
        </nav>
        <button type="button" className="nav-burger" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2238" strokeWidth="2.2" strokeLinecap="round"><path d={mobile ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        </button>
      </header>
      {mobile && (
        <nav className="mobile-nav" aria-label="Mobile">
          <Link href="/" onClick={() => setMobile(false)}>Home</Link>
          <Link href="/about" onClick={() => setMobile(false)}>About</Link>
          <Link href="/services" onClick={() => setMobile(false)}>Services</Link>
          {services.map((s) => (<div key={s.slug} style={{ display: "contents" }}><Link href={s.href} className="sub" onClick={() => setMobile(false)}>{s.title}</Link>{s.children.map((c) => <Link key={c.slug} href={c.href} className="sub" style={{ paddingLeft: 42 }} onClick={() => setMobile(false)}>{c.title}</Link>)}</div>))}
          <Link href="/healthy-home-resources" onClick={() => setMobile(false)}>Healthy Home Resources</Link>
          {hhr.map(([t, , h]) => <Link key={h} href={h} className="sub" onClick={() => setMobile(false)}>{t}</Link>)}
          <Link href="/caribbean-connection" onClick={() => setMobile(false)}>Caribbean Connection</Link>
          <Link href="/news" onClick={() => setMobile(false)}>News &amp; Insights</Link>
          <button type="button" className="btn btn-sky" style={{ marginTop: 10 }} onClick={() => { setMobile(false); open(sourceKey); }}>Schedule a Consultation</button>
        </nav>
      )}
    </div>
  );
}
