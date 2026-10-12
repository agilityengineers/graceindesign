import Link from "next/link";
import { asc, inArray } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, pages, pageBlocks, services } from "@/lib/db";
import { getMediaMap, resolveDeep } from "@/lib/data/media";
import { serviceHref } from "@/lib/data/site";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import HeroEditor, { type HeroTarget } from "@/components/admin/HeroEditor";

export const metadata = { title: "Hero editor" };
export const dynamic = "force-dynamic";
const PAGE_HREF: Record<string, string> = { home: "/", services: "/services", hhr: "/healthy-home-resources", caribbean: "/caribbean-connection", about: "/about" };

export default async function HeroPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireArea("hero");
  const sp = await searchParams;
  const [pageRows, svcRows, map] = await Promise.all([db.select().from(pages).orderBy(asc(pages.sort)), db.select().from(services).orderBy(asc(services.sort)), getMediaMap()]);
  const heroBlocks = pageRows.length ? await db.select().from(pageBlocks).where(inArray(pageBlocks.type, ["hero", "cine_hero", "about_hero"])) : [];
  const targets: HeroTarget[] = [];
  for (const p of pageRows) {
    const b = heroBlocks.find((x) => x.pageId === p.id); if (!b) continue;
    const c = resolveDeep(map, b.content as Record<string, any>);
    const classic = (c.classic as Record<string, any>) || {};
    targets.push({ kind: "page", id: p.key, label: p.title, style: p.heroStyle, href: PAGE_HREF[p.key] || p.slug, blockType: b.type, kicker: c.kicker || c.eyebrow || "", lead: c.lead || "", tail: c.tail || "", cta: c.cta || "", scenesLabel: c.scenesLabel || "", slideSeconds: Number(c.slideSeconds || 5), scenes: (c.scenes as HeroTarget["scenes"]) || [], sub: c.sub || "", secondary: c.secondary || "", classicTitle: b.type === "about_hero" ? c.title || "" : classic.title || "", classicSub: b.type === "about_hero" ? c.body || "" : classic.sub || "", classicImg: b.type === "about_hero" ? c.img || "" : classic.img || "", beforeAfter: null, supportsClassic: b.type !== "cine_hero", supportsCinematic: b.type !== "about_hero" });
  }
  for (const s of svcRows) {
    const r = resolveDeep(map, { scenes: s.scenes, beforeAfter: s.beforeAfter, img: s.img });
    const parent = s.parentId ? svcRows.find((x) => x.id === s.parentId) : null;
    targets.push({ kind: "service", id: s.slug, label: `${parent ? `${parent.title} › ` : ""}${s.title}`, style: s.heroStyle, href: serviceHref(s.slug, parent?.slug), blockType: "service", kicker: s.kicker, lead: s.cineLead || "", tail: s.cineTail || "", cta: s.cta, scenesLabel: s.scenesLabel || "", slideSeconds: s.slideSeconds, scenes: r.scenes, sub: "", secondary: "", classicTitle: s.hero, classicSub: s.sub, classicImg: r.img, beforeAfter: r.beforeAfter, supportsClassic: true, supportsCinematic: true });
  }
  const current = targets.find((t) => t.id === sp.page) || targets[0];
  return (
    <AdminShell user={user} active="hero" title="Hero editor" subtitle="Classic or cinematic hero per page, with scenes, words and photos" actions={current && <Link href={current.href} target="_blank" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Preview page →</Link>}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Pages & services" sub="Pick a hero to edit">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {targets.map((t) => <Link key={`${t.kind}:${t.id}`} href={`/admin/hero?page=${encodeURIComponent(t.id)}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: current?.id === t.id ? "#1a2238" : "transparent", color: current?.id === t.id ? "#fff" : "#1a2238", fontSize: 13 }}><span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span><span style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", opacity: .7 }}>{t.style}</span></Link>)}
          </div>
        </Card>
        {current ? <HeroEditor target={current} /> : <Card>No hero-capable pages yet.</Card>}
      </div>
    </AdminShell>
  );
}
