import Link from "next/link";
import CineHero, { Marquee } from "./CineHero";
import { ServiceClassicHero } from "./ClassicHero";
import BeforeAfter from "./BeforeAfter";
import ServiceLeadForm from "./ServiceLeadForm";
import { ConsultButton } from "./ConsultContext";
import { Star, Check } from "@/components/ui/Icons";
import { serviceHref } from "@/lib/data/site";
import { db, formFields } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import type { Service } from "@/lib/db";

type Svc = Service & { scenes: { name: string; word: string; line: string; img: string; imgAlt?: string }[]; beforeAfter: { before: string; after: string; title: string; beforeAlt?: string; afterAlt?: string } | null; imgAlt?: string; img2Alt?: string };
type Sibling = { id: number; slug: string; title: string; parentId: number | null; navGroup: string };

export default async function ServiceLanding({ s, all, heroStyle }: { s: Svc; all: Sibling[]; heroStyle: "classic" | "cinematic" }) {
  const slug = s.slug;
  const extras = s.pathId ? await db.select().from(formFields).where(and(eq(formFields.scope, "path"), eq(formFields.pathId, s.pathId), eq(formFields.visible, true))).orderBy(asc(formFields.sort)) : [];
  const isPartners = slug === "aip-partners";
  const others: { title: string; href: string }[] = isPartners
    ? [{ title: "AIP Products", href: "/healthy-home-resources/aip-products" }, { title: "WELLness Resources", href: "/healthy-home-resources/wellness" }, { title: "Home Health Series", href: "/healthy-home-resources/home-health-series" }, { title: "Aging In Place & Home Assessments", href: "/services/aging-in-place" }]
    : all.filter((x) => x.slug !== slug && x.navGroup === "services" && !x.parentId).map((x) => ({ title: x.title, href: serviceHref(x.slug) }));
  const rel: Record<string, string[]> = { residential: ["design-refresh", "model-home"], "design-refresh": ["residential", "model-home"], "aging-in-place": ["virtual-assessment"], "virtual-assessment": ["aging-in-place", "aip-partners"], "model-home": ["residential", "design-refresh"] };
  for (const r of (rel[slug] || []).slice().reverse()) { const x = all.find((y) => y.slug === r); if (x) others.unshift({ title: x.title, href: serviceHref(x.slug, x.parentId ? all.find((p) => p.id === x.parentId)?.slug : null) }); }
  const marqueeWords = [...s.scenes.map((x) => x.name), ...s.success];
  const hasBA = !!s.beforeAfter;
  const sourceKey = slug;
  const tiers = s.tiers || [];
  return (<>
    {heroStyle === "cinematic" ? (
      <>
        <CineHero kicker={s.kicker} kickerHref="/services" lead={s.cineLead || ""} tail={s.cineTail || ""} scenes={s.scenes} scenesLabel={s.scenesLabel || "What we design"} cta={s.cta} ctaSource={sourceKey} secondary={hasBA ? "See a before & after" : undefined} secondaryHref="#before-after" secondaryPlay slideSeconds={s.slideSeconds} />
        <Marquee words={marqueeWords} />
      </>
    ) : <ServiceClassicHero kicker={s.kicker} kickerHref="/services" title={s.hero} sub={s.sub} cta={s.cta} source={sourceKey} img={s.img} imgAlt={s.imgAlt} />}

    <section className="gx section g2 g2-stack-md" style={{ gap: 80, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}><span className="eyebrow">Sound familiar?</span><h2 className="h2">{s.problem}</h2></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 40 }}>
        <p className="body-lg" style={{ textWrap: "pretty" }}>{s.empathy}</p>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "24px 28px", borderRadius: 16, background: "#e6f3fc" }}><div style={{ width: 40, height: 40, flex: "none", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Star /></div><p style={{ fontSize: 15, lineHeight: 1.65 }}>{s.authority}</p></div>
      </div>
    </section>

    {hasBA && <BeforeAfter before={s.beforeAfter!.before} after={s.beforeAfter!.after} title={s.beforeAfter!.title} beforeAlt={s.beforeAfter!.beforeAlt} afterAlt={s.beforeAfter!.afterAlt} />}

    {s.features.length > 0 && (
      <section className="gx g2 g2-stack-md" style={{ paddingBottom: 104, gap: 64, alignItems: "center" }}>
        <div style={{ position: "relative", height: 520, borderRadius: 18, overflow: "hidden" }}><img src={s.img2} alt={s.img2Alt || ""} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <h2 className="h2" style={{ fontSize: 42 }}>What we help with</h2>
          <div className="g2 g2-stack-sm" style={{ gap: 16 }}>{s.features.map(([t, d]) => <div key={t} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 22, borderRadius: 14, border: "1px solid #e9ecf1" }}><span style={{ fontSize: 15, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 13.5, lineHeight: 1.6, color: "#6b7486" }}>{d}</span></div>)}</div>
        </div>
      </section>)}

    {tiers.length > 0 && (
      <section className="gx" style={{ paddingBottom: 104, display: "flex", flexDirection: "column", gap: 36 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}><span className="eyebrow">Flexible service tiers</span><h2 className="h2" style={{ fontSize: 44 }}>{s.tiersTitle}</h2><p style={{ fontSize: 15, lineHeight: 1.7, color: "#6b7486" }}>{s.tiersSub}</p></div>
        <div className="g3" style={{ gap: 24 }}>
          {tiers.map(([name, desc, price], k) => { const hi = k === 1; return (
            <div key={name} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 32, borderRadius: 18, border: `1px solid ${hi ? "#1a2238" : "#e9ecf1"}`, background: hi ? "#1a2238" : "#fff", color: hi ? "#fff" : "#1a2238" }}>
              <span className="eyebrow eyebrow-sm" style={{ color: hi ? "#6cb6e6" : "#3f9ad9" }}>Tier {k + 1}</span>
              <span className="display" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{name}</span>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: hi ? "#c6cbd6" : "#6b7486", flex: 1 }}>{desc}</p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6cb6e6" }} />{price}</span>
              <ConsultButton sourceKey={sourceKey} className="btn" style={{ height: 46, border: `1.5px solid ${hi ? "#6cb6e6" : "#1a2238"}`, background: hi ? "#6cb6e6" : "transparent", color: "#1a2238", fontSize: 13 }}>Request a quote</ConsultButton>
            </div>); })}
        </div>
        {s.steps && s.steps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 24 }}>
            <span className="eyebrow">Our approach</span>
            <div className="g5" style={{ gap: 0, border: "1px solid #e9ecf1", borderRadius: 16, overflow: "hidden" }}>{s.steps.map((st, k) => <div key={st} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "24px 22px", borderLeft: "1px solid #e9ecf1", background: k % 2 ? "#fbfcfd" : "#fff" }}><span className="display" style={{ fontSize: 30, color: "#6cb6e6", lineHeight: 1 }}>{String(k + 1).padStart(2, "0")}</span><span style={{ fontSize: 16, fontWeight: 600 }}>{st}</span></div>)}</div>
            {s.testimonialQuote && <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", borderRadius: 14, background: "#f7f8fa", border: "1px solid #e9ecf1" }}><span style={{ width: 44, height: 44, flex: "none", borderRadius: "50%", background: "#e6f3fc" }} /><div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 14, lineHeight: 1.5, color: "#4b5569", fontStyle: "italic" }}>"{s.testimonialQuote}"</span><span style={{ fontSize: 12, color: "#8c95a8" }}>{s.testimonialWho}</span></div></div>}
          </div>)}
      </section>)}

    <section className="gx" style={{ background: "#1a2238", color: "#fff", paddingTop: 96, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 56 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 700 }}><span className="eyebrow eyebrow-sky">The Plan</span><h2 className="h2" style={{ color: "#fff" }}>Three simple steps. One guide the whole way.</h2></div>
      <div className="g3" style={{ gap: 28 }}>{s.plan.map(([t, d], k) => <div key={t} style={{ display: "flex", flexDirection: "column", gap: 14, padding: 32, borderRadius: 16, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}><span className="display" style={{ fontSize: 44, color: "#6cb6e6", lineHeight: 1 }}>{String(k + 1).padStart(2, "0")}</span><span style={{ fontSize: 18, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 14, lineHeight: 1.65, color: "#c6cbd6" }}>{d}</span></div>)}</div>
    </section>

    <section className="gx section g2 g2-stack-md" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 80, alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span className="eyebrow">Picture the result</span><h2 className="h2" style={{ fontSize: 44 }}>What success looks like</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{s.success.map((w) => <div key={w} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 17 }}><span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check /></span>{w}</div>)}</div>
      </div>
      <div style={{ padding: 36, borderRadius: 18, border: "1px solid #e9ecf1", background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 12 }}><span className="eyebrow" style={{ color: "#6b7486", letterSpacing: ".16em" }}>Or, without a guide…</span><p className="display" style={{ fontSize: 28, lineHeight: 1.3 }}>{s.failure}</p></div>
    </section>

    <section id="lead-form" className="mx-gx g2 g2-stack-md" style={{ marginBottom: 104, padding: 72, borderRadius: 24, background: "#e6f3fc", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: 64, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span className="eyebrow">Take the first step</span><h2 className="h2">Tell us about your project</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>A few details is all we need. We'll follow up within one business day with next steps — no obligation.</p>
        {extras.length > 0 && <span style={{ fontSize: 12, color: "#6b7486", lineHeight: 1.6 }}>Questions marked <span className="extra-dot" style={{ fontWeight: 600 }}>●</span> are specific to this service.</span>}
      </div>
      <ServiceLeadForm slug={slug} title={s.title} cta={s.cta} pathId={s.pathId} extras={extras.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options, placeholder: f.placeholder, required: f.required }))} />
    </section>

    <section className="gx" style={{ paddingBottom: 104, display: "flex", flexDirection: "column", gap: 28 }}>
      <h2 className="display" style={{ fontSize: 34, fontWeight: 500 }}>{isPartners ? "More from Healthy Home Resources" : "Explore other services"}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>{others.map((o) => <Link key={o.href} href={o.href} className="btn btn-ghost" style={{ height: 44, padding: "0 20px", fontSize: 14, fontWeight: 500 }}>{o.title}</Link>)}</div>
    </section>
  </>);
}
