import Link from "next/link";
import CineHero, { type Scene } from "./CineHero";
import { HomeClassicHero } from "./ClassicHero";
import Carousel from "./Carousel";
import Reveal from "./Reveal";
import { ConsultButton } from "./ConsultContext";
import { ArrowRight, ArrowUpRight, Heart, Rss, Play, Globe } from "@/components/ui/Icons";
import { getProducts, getPublishedPosts, getFounder, getServiceList, getCaribbeanData } from "@/lib/data/site";
import { getMediaMap, resolveDeep } from "@/lib/data/media";
import { WELLNESS_GROUPS, EPISODES } from "@/lib/seed-data/demo";
import { fmtDate } from "@/lib/utils";
import CaribbeanForms, { NewsletterForm, SuggestResourceForm, SubmitEventForm, LeadMagnetForm } from "./CaribbeanForms";
import dynamic from "next/dynamic";

const ConsultForm = dynamic(() => import("./ConsultForm"));
export type Block = { id: number; type: string; content: Record<string, any> };

export async function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: { pageKey: string; heroStyle: "classic" | "cinematic"; sourceKey: string } }) {
  return (<>
    {blocks.map((b) => <BlockView key={b.id} block={b} ctx={ctx} />)}
    <Reveal />
  </>);
}

async function BlockView({ block: b, ctx }: { block: Block; ctx: { pageKey: string; heroStyle: "classic" | "cinematic"; sourceKey: string } }) {
  const c = b.content;
  switch (b.type) {
    case "hero": {
      if (ctx.heroStyle === "classic") return <HomeClassicHero kicker={c.kicker} title={c.classic.title} sub={c.classic.sub} cta={c.cta} source={ctx.sourceKey} secondary={c.secondary} secondaryHref={c.secondaryHref} img={c.classic.img} stats={c.classic.stats} badgeTitle={c.classic.badgeTitle} badgeSub={c.classic.badgeSub} />;
      return <CineHero kicker={c.kicker} lead={c.lead} tail={c.tail} scenes={c.scenes as Scene[]} scenesLabel={c.scenesLabel} cta={c.cta} ctaSource={ctx.sourceKey} secondary={c.secondary} secondaryHref={c.secondaryHref} slideSeconds={c.slideSeconds} hoverSelects />;
    }
    case "cine_hero": return <CineHero kicker={c.kicker} lead={c.lead} tail={c.tail} scenes={c.scenes as Scene[]} scenesLabel={c.scenesLabel} cta={c.cta} ctaHref={c.ctaHref} ctaSource={c.ctaHref?.startsWith("/contact") ? ctx.sourceKey : undefined} secondary={c.secondary} secondaryHref={c.secondaryHref} sub={c.sub} height={720} hoverSelects={!!c.hoverSelects} wordOnly={!!c.wordOnly} slideSeconds={c.slideSeconds} />;
    case "steps": return (
      <section className="gx g3" style={{ paddingTop: 56, paddingBottom: 56, borderBottom: "1px solid #eef0f4", gap: 0 }}>
        {(c.items as [string, string][]).map(([t, d], k) => <div key={t} className="step-cell" style={{ display: "flex", gap: 18, padding: k === 0 ? "0 40px 0 0" : k === 1 ? "0 40px" : "0 0 0 40px", borderLeft: k ? "1px solid #eef0f4" : 0 }}><span className="display" style={{ fontSize: 44, fontWeight: 500, color: "#6cb6e6", lineHeight: 1 }}>{k + 1}</span><div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ fontSize: 16, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7486" }}>{d}</span></div></div>)}
      </section>);
    case "services_grid": return (
      <section className="gx" style={{ paddingTop: 104, paddingBottom: 112, display: "flex", flexDirection: "column", gap: 56 }}>
        <div className="g2 g2-stack-sm" style={{ alignItems: "flex-end", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2" style={{ fontSize: 50, lineHeight: 1.08 }}>{c.title}</h2></div>
          <p style={{ maxWidth: 380, fontSize: 15, lineHeight: 1.7, color: "#6b7486", justifySelf: "end" }}>{c.intro}</p>
        </div>
        <div className="svc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 24 }}>
          {(c.cards as any[]).map((s, k) => (
            <article key={s.title} className="card-hover card-lift" style={{ gridColumn: `span ${k < 4 ? 3 : 4}`, display: "flex", flexDirection: "column", background: "#fff", border: "1px solid #e9ecf1", borderRadius: 18, overflow: "hidden" }}>
              <div style={{ position: "relative", height: 230 }}><img src={s.img} alt={s.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "26px 26px 28px", flex: 1 }}>
                <span className="eyebrow eyebrow-sm">{s.kicker}</span>
                <h3 style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.25 }}>{s.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#6b7486", flex: 1, textWrap: "pretty" }}>{s.blurb}</p>
                <Link href={s.href} className="btn btn-outline" style={{ height: 42, padding: "0 20px", fontSize: 13, alignSelf: "flex-start", marginTop: 8 }}>Learn More <ArrowRight /></Link>
              </div>
            </article>))}
        </div>
      </section>);
    case "why_band": return (
      <section className="gx g2 g2-stack-md" style={{ position: "relative", background: "#1a2238", color: "#fff", paddingTop: 96, paddingBottom: 96, gap: 80, alignItems: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -120, top: -120, width: 420, height: 420, borderRadius: "50%", background: "#6cb6e6", opacity: .12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}><img src={c.founderPhoto} alt="Grace, Founder" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", objectPosition: "center 30%", border: "2px solid #6cb6e6" }} /><div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{c.founderName}</span><span style={{ fontSize: 12, color: "#c6cbd6" }}>{c.founderCreds}</span></div></div>
          <span className="eyebrow eyebrow-sky">{c.eyebrow}</span>
          <h2 className="h2" style={{ fontSize: 48, color: "#fff" }}>{c.title}</h2>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "#c6cbd6", maxWidth: 520 }}>{c.body}</p>
          <ConsultButton sourceKey={ctx.sourceKey} className="btn btn-sky" style={{ height: 54, padding: "0 28px", alignSelf: "flex-start", marginTop: 8, boxShadow: "none" }}>{c.cta}</ConsultButton>
        </div>
        <div className="g2" style={{ gap: 20, position: "relative" }}>
          {(c.cards as [string, string][]).map(([t, d]) => <div key={t} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 28, borderRadius: 16, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}><span className="display" style={{ fontSize: 22, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 13.5, lineHeight: 1.6, color: "#c6cbd6" }}>{d}</span></div>)}
        </div>
      </section>);
    case "featured_products": { const products = (await getProducts(true)).slice(0, c.count || 4); return (
      <section className="gx" style={{ paddingTop: 104, paddingBottom: 104, background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 600 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2">{c.title}</h2></div>
          <Link href={c.linkHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, borderBottom: "1.5px solid #1a2238", paddingBottom: 2 }}>{c.linkLabel} <ArrowUpRight /></Link>
        </div>
        <div className="g4" style={{ gap: 24 }}>{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>); }
    case "news": { const posts = (await getPublishedPosts("news", c.count || 3)).slice(0, c.count || 3); return (
      <section className="gx" style={{ paddingTop: 104, paddingBottom: 112, display: "flex", flexDirection: "column", gap: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 600 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2">{c.title}</h2></div>
          <Link href={c.linkHref} style={{ fontSize: 14, fontWeight: 600, borderBottom: "1.5px solid #1a2238", paddingBottom: 2 }}>{c.linkLabel}</Link>
        </div>
        <div className="g3" style={{ gap: 32 }}>{posts.map((a) => <PostCard key={a.id} post={a} height={260} />)}</div>
      </section>); }
    case "cta": return (
      <section className="mx-gx" style={{ marginBottom: 104, padding: "72px 80px", borderRadius: 24, background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}><h2 className="h2" style={{ fontSize: 44 }}>{c.title}</h2><p style={{ fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p></div>
        <ConsultButton sourceKey={ctx.sourceKey} className="btn btn-navy btn-lg" style={{ fontWeight: 700 }}>{c.cta} <ArrowRight size={18} color="#fff" width={2} /></ConsultButton>
      </section>);
    case "about_hero": return (
      <section className="hero-classic" style={{ minHeight: 600 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "88px 64px 88px var(--gutter)", gap: 24, minWidth: 0 }}>
          <span className="eyebrow">{c.eyebrow}</span><h1 className="h1">{c.title}</h1><p className="lede" style={{ maxWidth: 540 }}>{c.body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>{(c.chips as string[]).map((ch) => <span key={ch} className="pill" style={{ cursor: "default" }}>{ch}</span>)}</div>
        </div>
        <div className="hero-photo-wrap" style={{ position: "relative", minWidth: 0, minHeight: 0 }}><div className="hero-photo"><img src={c.img} alt="Grace In Design studio" /></div></div>
      </section>);
    case "about_intro": return (
      <section className="gx section" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 72, alignItems: "start" }} data-stack>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2" style={{ fontSize: 44 }}>{c.title}</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 34 }}>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "#4b5569" }}>{c.p1}</p><p style={{ fontSize: 16, lineHeight: 1.75, color: "#4b5569" }}>{c.p2}</p>
          <div className="g4" style={{ gap: 14, marginTop: 8 }}>{(c.areas as [string, string][]).map(([t, d]) => <div key={t} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 18, borderRadius: 14, background: "#f7f8fa" }}><span style={{ fontSize: 14, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6b7486" }}>{d}</span></div>)}</div>
        </div>
      </section>);
    case "founder": { const f = await getFounder(); if (!f) return null; return (
      <section className="mx-gx founder-grid" style={{ marginBottom: 104, padding: "64px 72px", borderRadius: 24, background: "#f7f8fa", display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", gap: 56, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "sticky", top: 24 }}>
          <div style={{ position: "relative", width: 220, aspectRatio: "625/991", borderRadius: 16, overflow: "hidden" }}><img src={f.photoUrl || "/assets/grace-headshot-bw.jpg"} alt={f.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 18, fontWeight: 600 }}>{f.name}</span><span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#6b7486" }}>{f.credentials}</span><span style={{ fontSize: 12.5, color: "#6b7486" }}>{f.title}</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span className="eyebrow">{c.eyebrow}</span>
          <blockquote className="display" style={{ margin: 0, fontSize: 34, fontWeight: 500, lineHeight: 1.2, textWrap: "pretty" }}>“{f.quote}”</blockquote>
          <p style={{ fontSize: 16, lineHeight: 1.75, color: "#4b5569" }}>{f.bio}</p>
          {f.bio2 && <p style={{ fontSize: 16, lineHeight: 1.75, color: "#4b5569" }}>{f.bio2}</p>}
          <div className="g2 g2-stack-sm" style={{ gap: 14, marginTop: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 20, borderRadius: 14, background: "#fff", border: "1px solid #e9ecf1" }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>Education</span>{f.education.map((e) => <span key={e} style={{ fontSize: 14, lineHeight: 1.6 }}>{e}</span>)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 20, borderRadius: 14, background: "#fff", border: "1px solid #e9ecf1" }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>Credentials</span>{f.credentialList.map((e) => <span key={e} style={{ fontSize: 14, lineHeight: 1.6 }}>{e}</span>)}</div>
          </div>
          <ConsultButton sourceKey={ctx.sourceKey} className="btn btn-navy" style={{ height: 50, padding: "0 26px", alignSelf: "flex-start", marginTop: 6 }}>{c.cta}</ConsultButton>
        </div>
      </section>); }
    case "service_list": { const list = await getServiceList(); return (
      <section className="gx" style={{ paddingTop: 80, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 40 }}>
        {list.map((s, k) => (
          <article key={s.slug} className="reveal g2 g2-stack-sm" style={{ gap: 64, alignItems: "center", padding: "40px 0", borderBottom: "1px solid #eef0f4" }}>
            <div style={{ position: "relative", height: 360, borderRadius: 18, overflow: "hidden", order: k % 2 ? 2 : 0 }}><img src={s.img} alt={s.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <span className="display" style={{ fontSize: 40, color: "#6cb6e6", lineHeight: 1 }}>{String(k + 1).padStart(2, "0")}</span>
              <h2 className="h2" style={{ fontSize: 42 }}>{s.title}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4b5569", textWrap: "pretty" }}>{s.sub}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                <Link href={`/services/${s.slug}`} className="btn btn-navy">Learn More <ArrowRight /></Link>
                {s.children.map((ch) => <Link key={ch.slug} href={ch.slug === "virtual-assessment" ? "/services/aging-in-place/virtual" : `/services/${s.slug}/${ch.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#3f9ad9" }}>{ch.title} <ArrowRight size={12} width={2.4} /></Link>)}
              </div>
            </div>
          </article>))}
      </section>); }
    case "hhr_cards": return (
      <section className="gx g4" style={{ paddingTop: 104, paddingBottom: 104, gap: 24 }}>
        {(c.cards as any[]).map((card) => (
          <Link key={card.title} href={card.href} className="reveal card-hover" style={{ display: "flex", flexDirection: "column", border: "1px solid #e9ecf1", borderRadius: 18, overflow: "hidden", color: "#1a2238" }}>
            <div style={{ position: "relative", height: 220 }}><img src={card.img} alt={card.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 28 }}><span className="eyebrow eyebrow-sm">{card.kicker}</span><h2 className="h3">{card.title}</h2><p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#6b7486" }}>{card.body}</p><span style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{card.cta} →</span></div>
          </Link>))}
      </section>);
    case "assessment_cta": return (
      <section className="reveal mx-gx" style={{ marginBottom: 104, padding: "64px 80px", borderRadius: 24, background: "#1a2238", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}><h2 className="h2" style={{ fontSize: 40, color: "#fff" }}>{c.title}</h2><p style={{ fontSize: 15, lineHeight: 1.7, color: "#c6cbd6" }}>{c.body}</p></div>
        <ConsultButton sourceKey="aging-in-place" className="btn btn-sky btn-md" style={{ boxShadow: "none" }}>{c.cta}</ConsultButton>
      </section>);
    case "page_header": return (
      <section className="gx" style={{ padding: c.compact ? "88px var(--gutter) 64px" : "88px var(--gutter) 56px", background: "#f7f8fa", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
          {c.crumb ? <Link href={c.crumbHref || "#"} className="eyebrow">{c.crumb}</Link> : <span className="eyebrow">{c.eyebrow}</span>}
          <h1 className="h1" style={{ fontSize: 60 }}>{c.title}</h1>
          {c.body && <p style={{ maxWidth: 620, fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p>}
        </div>
        {c.badge && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e9ecf1", fontSize: 13, color: "#6b7486", whiteSpace: "nowrap" }}>{c.badgeRss ? <Rss /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.badgeDot || "#6cb6e6" }} />}{c.badge}{c.badge === "Sold on Etsy" && <> · <strong style={{ color: "#1a2238" }}>{(await getProducts()).length} listings</strong></>}</div>}
      </section>);
    case "product_carousel": { const all = await getProducts(); return <Carousel eyebrow={c.eyebrow} title={c.title} cardWidth={306} count={all.length}>{all.map((p) => <ProductCard key={p.id} p={p} compact />)}</Carousel>; }
    case "product_grid": { const all = await getProducts(); const ProductGrid = (await import("./ProductGrid")).default; return <ProductGrid title={c.title} categories={c.categories} products={all.map((p) => ({ id: p.id, title: p.title, category: p.category, price: p.price, reviews: p.reviews, type: p.type, tag: p.tag || "", img: p.imageUrl || "", url: p.etsyUrl }))} />; }
    case "guide_carousel": { const map = await getMediaMap(); const items = WELLNESS_GROUPS.flatMap((g) => g.items.map((r) => ({ concept: g.title, kind: r[0], title: r[1], desc: r[2], img: resolveDeep(map, r[3]) }))).slice(0, 6); return (
      <Carousel eyebrow={c.eyebrow} title={c.title} cardWidth={416} count={items.length}>{items.map((r, k) => (
        <a key={k} href="#guides" className="card-hover" style={{ display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden", border: "1px solid #e9ecf1", color: "#1a2238" }}>
          <div style={{ position: "relative", height: 240 }}><img src={r.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /><span style={{ position: "absolute", top: 12, left: 12, padding: "5px 10px", borderRadius: 999, background: "#fff", fontSize: 11, fontWeight: 600 }}>{r.kind}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "20px 22px 22px" }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{r.concept}</span><span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</span><span style={{ fontSize: 13.5, lineHeight: 1.55, color: "#6b7486" }}>{r.desc}</span></div>
        </a>))}</Carousel>); }
    case "wellness_groups": { const map = await getMediaMap(); const lm = c.leadMagnet; return (
      <section id="guides" className="gx wellness-grid" style={{ paddingTop: 80, paddingBottom: 104, display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 64, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          {WELLNESS_GROUPS.map((g) => (
            <div key={g.letter} className="reveal" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}><span className="display" style={{ width: 52, height: 52, borderRadius: 14, background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 600, color: "#3f9ad9" }}>{g.letter}</span><div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h2 className="display" style={{ fontSize: 34, fontWeight: 600 }}>{g.title}</h2><span style={{ fontSize: 14, color: "#6b7486" }}>{g.sub}</span></div></div>
              <div className="g2 g2-stack-sm" style={{ gap: 16 }}>
                {g.items.map(([kind, title, desc, img]) => <a key={title} href="#guides" className="card-hover" style={{ display: "flex", gap: 16, padding: 20, borderRadius: 14, border: "1px solid #e9ecf1", color: "#1a2238" }}><div style={{ width: 96, height: 96, flex: "none", borderRadius: 10, overflow: "hidden", position: "relative" }}><img src={resolveDeep(map, img)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div><div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{kind}</span><span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{title}</span><span style={{ fontSize: 13, lineHeight: 1.55, color: "#6b7486" }}>{desc}</span></div></a>)}
              </div>
            </div>))}
        </div>
        <aside style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 20, padding: 32, borderRadius: 18, background: "#1a2238", color: "#fff" }}>
          <span className="eyebrow eyebrow-sky" style={{ letterSpacing: ".16em" }}>{lm.eyebrow}</span>
          <h3 className="display" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.15 }}>{lm.title}</h3>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "#c6cbd6" }}>{lm.body}</p>
          <LeadMagnetForm cta={lm.cta} />
          <Link href={lm.linkHref} style={{ fontSize: 13, color: "#c6cbd6", textAlign: "center" }}>{lm.link}</Link>
        </aside>
      </section>); }
    case "featured_episode": { const map = await getMediaMap(); const ep = EPISODES.find((e) => e.featured) || EPISODES[0]; return (
      <section className="reveal gx g2 g2-stack-sm" style={{ paddingTop: 72, gap: 48, alignItems: "center", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
        <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 20, overflow: "hidden" }}><img src={resolveDeep(map, ep.img)} alt={ep.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /><div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ width: 84, height: 84, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 44px rgba(26,34,56,.3)" }}><Play size={30} color="#1a2238" /></span></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow">Latest episode · {ep.num}</span>
          <h2 className="h2" style={{ fontSize: 40 }}>{ep.title}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#4b5569" }}>{ep.desc}</p>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 13, color: "#6b7486" }}><span>{ep.len}</span><span style={{ width: 3, height: 3, borderRadius: "50%", background: "#c6cbd6" }} /><span>{fmtDate(new Date(Date.now() - ep.date * 86400000), { month: "short", day: "numeric", year: "numeric" })}</span></div>
          <a href="#episodes" className="btn btn-navy" style={{ alignSelf: "flex-start" }}>Watch now</a>
        </div>
      </section>); }
    case "episode_carousel": { const map = await getMediaMap(); const eps = EPISODES.filter((e) => !e.featured); return (<div id="episodes"><Carousel eyebrow={c.eyebrow} title={c.title} cardWidth={416} count={eps.length}>{eps.map((e) => (
      <a key={e.num} href="#episodes" style={{ display: "flex", flexDirection: "column", gap: 14, color: "#1a2238" }}>
        <div style={{ position: "relative", aspectRatio: "16/10", borderRadius: 14, overflow: "hidden" }}><img src={resolveDeep(map, e.img)} alt={e.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /><span style={{ position: "absolute", bottom: 10, right: 10, padding: "4px 8px", borderRadius: 6, background: "rgba(26,34,56,.85)", color: "#fff", fontSize: 11, fontWeight: 600 }}>{e.len}</span><span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}><span style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} color="#1a2238" /></span></span></div>
        <span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>Episode {e.num} · {e.room}</span>
        <h3 className="display" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{e.title}</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6b7486" }}>{e.desc}</p>
      </a>))}</Carousel><div style={{ height: 104 }} /></div>); }
    case "news_grid": { const all = await getPublishedPosts("news", (c.count || 6) + 1); const [feat, ...rest] = all; return (
      <section className="gx" style={{ paddingTop: 72, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 56 }}>
        {feat && <Link href={`/news/${feat.slug}`} className="g2 g2-stack-sm" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 48, alignItems: "center", color: "#1a2238" }}>
          <div style={{ position: "relative", height: 460, borderRadius: 20, overflow: "hidden" }}><img src={feat.imageUrl || ""} alt={feat.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}><PostMeta post={feat} /><h2 className="display" style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.1, textWrap: "pretty" }}>{feat.title}</h2><p style={{ fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>{feat.excerpt}</p><span style={{ fontSize: 14, fontWeight: 600 }}>Read article →</span></div>
        </Link>}
        <div className="g3" style={{ gap: 32 }}>{rest.slice(0, c.count || 6).map((p) => <PostCard key={p.id} post={p} height={240} />)}</div>
      </section>); }
    case "contact_header": return (
      <section className="gx" style={{ padding: "72px var(--gutter) 32px", background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 14 }}>
        <span className="eyebrow">{c.eyebrow}</span><h1 className="h1" style={{ fontSize: 56, maxWidth: 800 }}>{c.title}</h1><p style={{ maxWidth: 600, fontSize: 16, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p>
      </section>);
    case "consult_form": return <section className="gx" style={{ padding: "0 var(--gutter) 104px", background: "#f7f8fa" }}><ConsultForm sourcePage={ctx.sourceKey} /></section>;
    case "contact_steps": return (
      <section className="gx g3" style={{ paddingTop: 80, paddingBottom: 80, gap: 28 }}>
        {(c.items as [string, string][]).map(([t, d], k) => <div key={t} style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="display" style={{ fontSize: 40, color: "#6cb6e6", lineHeight: 1 }}>{String(k + 1).padStart(2, "0")}</span><span style={{ fontSize: 16, fontWeight: 600 }}>{t}</span><span style={{ fontSize: 14, lineHeight: 1.65, color: "#6b7486" }}>{d}</span></div>)}
      </section>);
    case "rich_text": return <section className="gx section" style={{ maxWidth: 860 }}><h1 className="h1" style={{ marginBottom: 28 }}>{c.title}</h1><div className="prose" style={{ fontSize: 16, lineHeight: 1.75, color: "#4b5569" }} dangerouslySetInnerHTML={{ __html: c.body }} /></section>;
    case "cc_why": { const { countries } = await getCaribbeanData(); return (
      <section className="gx section g2 g2-stack-md" style={{ gap: 80, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2">{c.title}</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 40 }}>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "24px 28px", borderRadius: 16, background: "#e6f3fc" }}><div style={{ width: 40, height: 40, flex: "none", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Globe /></div><p style={{ fontSize: 15, lineHeight: 1.65 }}><strong>{c.calloutBold}</strong> {c.callout}</p></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{countries.map((k) => { const live = k.status === "live"; return <span key={k.id} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, border: `1px solid ${live ? "#1a2238" : "#e3e6ec"}`, background: live ? "#1a2238" : "#fff", fontSize: 12, fontWeight: 600, color: live ? "#fff" : "#1a2238" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "#6cb6e6" : "#c6cbd6" }} />{k.name}<span style={{ fontWeight: 500, color: "#8c95a8" }}>{live ? "Launch" : k.status === "next" ? "Next" : "Planned"}</span></span>; })}</div>
        </div>
      </section>); }
    case "cc_pillars": return (
      <section className="gx g4" style={{ paddingBottom: 104, gap: 24 }}>
        {(c.pillars as any[]).map((p) => <a key={p.title} href={p.href} className="reveal card-hover" style={{ display: "flex", flexDirection: "column", border: "1px solid #e9ecf1", borderRadius: 18, overflow: "hidden", color: "#1a2238" }}><div style={{ position: "relative", height: 200 }}><img src={p.img} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div><div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 26 }}><span className="eyebrow eyebrow-sm">{p.kicker}</span><h2 className="h3">{p.title}</h2><p style={{ fontSize: 14, lineHeight: 1.65, color: "#6b7486" }}>{p.desc}</p><span style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{p.cta} →</span></div></a>)}
      </section>);
    case "cc_blog": { const { gidPosts, regional } = await getCaribbeanData(); const [feat, ...more] = gidPosts; return (
      <section id="blog" className="gx" style={{ paddingTop: 96, paddingBottom: 96, background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}><span className="eyebrow">{c.eyebrow}</span><h2 className="h2">{c.title}</h2></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, background: "#fff", border: "1px solid #e9ecf1", fontSize: 13, color: "#6b7486", whiteSpace: "nowrap" }}><Rss />{c.badge}</div>
        </div>
        <div className="g2 g2-stack-md" style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 40, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {feat && <Link href={`/news/${feat.slug}`} style={{ display: "flex", flexDirection: "column", gap: 16, color: "#1a2238" }}>
              <div style={{ position: "relative", height: 380, borderRadius: 18, overflow: "hidden" }}><img src={feat.imageUrl || ""} alt={feat.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /><span style={{ position: "absolute", top: 16, left: 16, padding: "6px 12px", borderRadius: 999, background: "#1a2238", color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>GID Article</span></div>
              <PostMeta post={feat} /><h3 className="display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.15, textWrap: "pretty" }}>{feat.title}</h3><p style={{ fontSize: 15, lineHeight: 1.7, color: "#4b5569" }}>{feat.excerpt}</p>
            </Link>}
            <div className="g2 g2-stack-sm" style={{ gap: 24 }}>{more.map((g) => <Link key={g.id} href={`/news/${g.slug}`} style={{ display: "flex", flexDirection: "column", gap: 12, color: "#1a2238" }}><div style={{ position: "relative", height: 180, borderRadius: 14, overflow: "hidden" }}><img src={g.imageUrl || ""} alt={g.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".1em" }}>{g.category} · {fmtDate(g.publishedAt, { month: "short", day: "numeric", year: "numeric" })}</span><h3 className="display" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>{g.title}</h3><p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#6b7486" }}>{g.excerpt}</p></Link>)}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="eyebrow eyebrow-sm" style={{ color: "#6b7486" }}>{c.regionalLabel}</span><span style={{ fontSize: 11, color: "#8c95a8" }}>Updated hourly via RSS</span></div>
            {regional.map((r) => <a key={r.id} href={r.sourceUrl || "#"} target={r.sourceUrl && r.sourceUrl !== "#" ? "_blank" : undefined} rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 14, padding: 14, borderRadius: 14, background: "#fff", border: "1px solid #e9ecf1", color: "#1a2238" }}><div style={{ position: "relative", width: 72, height: 60, borderRadius: 8, overflow: "hidden" }}><img src={r.imageUrl || ""} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div><div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{r.title}</span><span style={{ fontSize: 11, color: "#6b7486" }}>{r.sourceName} · {fmtDate(r.publishedAt)}</span></div></a>)}
            <span style={{ fontSize: 12, color: "#8c95a8", lineHeight: 1.6 }}>{c.regionalNote}</span>
          </div>
        </div>
      </section>); }
    case "cc_directory": { const { resources } = await getCaribbeanData(); const Dir = (await import("./CaribbeanDirectory")).default; return (
      <section id="directory" className="gx" style={{ paddingTop: 104, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 40 }}>
        <Dir eyebrow={c.eyebrow} title={c.title} categories={c.categories} resources={resources.map((r) => ({ id: r.id, name: r.name, category: r.category, where: r.area ? `${r.country} · ${r.area}`.replace(/ · National$/, "") : r.country, type: r.type || "", description: r.description, url: r.url || "" }))} />
        <div id="suggest-resource" className="g2 g2-stack-md" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)", gap: 40, padding: "36px 40px", borderRadius: 20, background: "#f7f8fa", border: "1px solid #e9ecf1" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span className="eyebrow">{c.formEyebrow}</span><h3 className="display" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.1 }}>{c.formTitle}</h3><p style={{ fontSize: 14, lineHeight: 1.65, color: "#4b5569" }}>{c.formBody}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#6b7486" }}>{(c.bullets as string[]).map((b) => <span key={b} style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6cb6e6" }} />{b}</span>)}</div>
          </div>
          <SuggestResourceForm />
        </div>
      </section>); }
    case "cc_events": { const { events } = await getCaribbeanData(); return (
      <section id="events" className="gx g2 g2-stack-md" style={{ paddingBottom: 104, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 64, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          <span className="eyebrow">{c.eyebrow}</span><h2 className="h2" style={{ fontSize: 44 }}>{c.title}</h2><p style={{ fontSize: 15, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p>
          <a href="#suggest-event" className="btn btn-navy" style={{ alignSelf: "flex-start" }}>Submit an event</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map((e, k) => { const virtual = e.format === "virtual"; const d = e.startsAt; const bg = k === 0 ? "#1a2238" : virtual ? "#e6f3fc" : "#f7f8fa"; const color = k === 0 ? "#fff" : "#1a2238"; return (
            <div key={e.id} className="reveal" style={{ display: "grid", gridTemplateColumns: "84px 1fr auto", gap: 20, alignItems: "center", padding: "20px 24px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 84, height: 84, borderRadius: 14, background: bg, color }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{fmtDate(d, { month: "short" }, e.tz)}</span><span className="display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>{fmtDate(d, { day: "numeric" }, e.tz)}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{e.title}</span>{virtual && <span style={{ padding: "3px 8px", borderRadius: 999, background: "#e6f3fc", fontSize: 10, fontWeight: 700, letterSpacing: ".06em" }}>VIRTUAL</span>}</div><span style={{ fontSize: 13, lineHeight: 1.55, color: "#6b7486" }}>{e.description}</span><span style={{ fontSize: 12, color: "#8c95a8" }}>{e.whereLabel} · {e.host}</span></div>
              <a href={e.url || "#events"} target={e.url ? "_blank" : undefined} rel="noreferrer" className="btn btn-ghost btn-sm" style={{ height: 40 }}>Details</a>
            </div>); })}
          <div id="suggest-event" style={{ marginTop: 12, padding: 28, borderRadius: 16, background: "#f7f8fa", border: "1px solid #e9ecf1", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span className="eyebrow eyebrow-sm">{c.formEyebrow}</span><span style={{ fontSize: 14, lineHeight: 1.6, color: "#4b5569" }}>{c.formBody}</span></div>
            <SubmitEventForm />
          </div>
        </div>
      </section>); }
    case "cc_newsletter": return (
      <section id="newsletter" className="mx-gx g2 g2-stack-md" style={{ marginBottom: 104, padding: "72px 80px", borderRadius: 24, background: "#1a2238", color: "#fff", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="eyebrow eyebrow-sky">{c.eyebrow}</span><h2 className="h2" style={{ fontSize: 44, color: "#fff" }}>{c.title}</h2><p style={{ fontSize: 15, lineHeight: 1.7, color: "#c6cbd6", maxWidth: 520 }}>{c.body}</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, color: "#c6cbd6" }}>{(c.bullets as string[]).map((b) => <span key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6cb6e6" }} />{b}</span>)}</div>
        </div>
        <NewsletterForm />
      </section>);
    default: return <CaribbeanForms kind={b.type} />;
  }
}

export function ProductCard({ p, compact }: { p: { id: number; title: string; price: string; reviews: string; type: string; tag: string | null; imageUrl: string | null; etsyUrl: string }; compact?: boolean }) {
  return (
    <a href={p.etsyUrl} target="_blank" rel="noreferrer" className="card-hover" style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e9ecf1", color: "#1a2238" }}>
      <div style={{ position: "relative", aspectRatio: "1/1" }}>
        <img src={p.imageUrl || ""} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        {p.tag && <span style={{ position: "absolute", top: 12, left: 12, padding: "5px 10px", borderRadius: 999, background: "#fff", fontSize: 11, fontWeight: 600 }}>{p.tag}</span>}
        {!compact && <span style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Heart /></span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px 18px" }}>
        <span style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.4 }}>{p.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7486" }}><span style={{ color: "#f0a500", letterSpacing: -1 }}>★★★★★</span><span>{p.reviews}</span></div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 18, fontWeight: 700 }}>{p.price}</span><span style={{ fontSize: 11, fontWeight: 600, color: "#3f9ad9" }}>{p.type}</span></div>
      </div>
    </a>
  );
}

export function PostMeta({ post }: { post: { category: string; publishedAt: Date | null } }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#6b7486" }}><span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".1em" }}>{post.category}</span><span style={{ width: 3, height: 3, borderRadius: "50%", background: "#c6cbd6" }} /><span>{fmtDate(post.publishedAt, { month: "short", day: "numeric", year: "numeric" })}</span></div>;
}

export function PostCard({ post, height }: { post: { slug: string; title: string; excerpt: string | null; imageUrl: string | null; category: string; publishedAt: Date | null }; height: number }) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link href={`/news/${post.slug}`} style={{ position: "relative", height, borderRadius: 16, overflow: "hidden", display: "block" }}><img src={post.imageUrl || ""} alt={post.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></Link>
      <PostMeta post={post} />
      <h3 className="display" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2, textWrap: "pretty" }}><Link href={`/news/${post.slug}`}>{post.title}</Link></h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#6b7486", textWrap: "pretty" }}>{post.excerpt}</p>
      <Link href={`/news/${post.slug}`} style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", gap: 8, alignItems: "center" }}>Read article <ArrowRight /></Link>
    </article>
  );
}
