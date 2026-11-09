"use client";
/**
 * WELLness Resources: the pop-open resource panel.
 *
 * Clicking a guide card opens the resource over the page (kind, concept, title, description, a large image and a
 * download button) with the page's other resources listed beside it, so a visitor can move between guides without
 * leaving the page. `?guide=<slug>` on the address bar follows the open resource, so a guide can be linked to directly.
 * Dialog behaviour (Escape, focus trap, scroll lock, focus restore) mirrors ConsultContext.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Close } from "@/components/ui/Icons";
import { isDownload } from "@/lib/wellness";

/** A WELL resource card with its `?guide=` slug, image already resolved to a URL, and the concept it files under. */
export type PanelResource = { slug: string; kind: string; title: string; desc: string; img: string; href: string; concept: string };
export type PanelGroup = { letter: string; title: string; sub: string; resources: PanelResource[] };

const PARAM = "guide";
type Ctx = { open: (slug: string) => void; close: () => void };
const PanelCtx = createContext<Ctx | null>(null);

/** Sets or clears `?guide=` on the address bar without navigating; other params (preview, from) are kept. */
function setGuideParam(slug: string | null) {
  const url = new URL(window.location.href);
  if (slug) url.searchParams.set(PARAM, slug); else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url);
}

const cover: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };
const pdfTag = (href: string) => (isDownload(href) ? " · PDF" : "");
/** A PDF or external link opens in a new tab; a page on this site navigates normally (as the cards did before the panel). */
const linkProps = (href: string) => (isDownload(href) || /^https?:\/\//.test(href) ? { target: "_blank", rel: "noreferrer" } : {});

export function ResourcePanelProvider({ groups, featured, children }: { groups: PanelGroup[]; featured: string[]; children: ReactNode }) {
  const all = useMemo(() => groups.flatMap((g) => g.resources), [groups]);
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const prevActive = useRef<string | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const open = useCallback((slug: string) => {
    if (!all.some((r) => r.slug === slug)) return;
    if (!activeRef.current) lastFocus.current = document.activeElement as HTMLElement; // the card that opened it, not a side-list button
    activeRef.current = slug; setActive(slug); setGuideParam(slug);
    mainRef.current?.scrollTo({ top: 0 });
  }, [all]);
  const close = useCallback(() => { activeRef.current = null; setActive(null); setGuideParam(null); setTimeout(() => lastFocus.current?.focus?.(), 0); }, []);

  // Deep link: /healthy-home-resources/wellness?guide=<slug> opens that resource on load.
  useEffect(() => { const slug = new URLSearchParams(window.location.search).get(PARAM); if (slug && all.some((r) => r.slug === slug)) { activeRef.current = slug; setActive(slug); } }, [all]);

  useEffect(() => {
    const opening = !!active && !prevActive.current;
    prevActive.current = active;
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    if (opening) setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button")?.focus(), 50);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [active, close]);

  const current = active ? all.find((r) => r.slug === active) : undefined;
  const featuredItems = featured.map((s) => all.find((r) => r.slug === s)).filter((r): r is PanelResource => !!r);
  const sections = [...(featuredItems.length ? [{ title: "Featured", items: featuredItems }] : []), ...groups.filter((g) => g.resources.length > 0).map((g) => ({ title: g.title, items: g.resources }))];

  return (
    <PanelCtx.Provider value={{ open, close }}>
      {children}
      {current && (
        <div className="modal-backdrop" onClick={close} role="presentation">
          <div ref={panelRef} className="modal-panel resource-panel" role="dialog" aria-modal="true" aria-label={current.title} onClick={(e) => e.stopPropagation()} style={{ width: 1120 }}>
            <button type="button" onClick={close} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(26,34,56,.2)", cursor: "pointer" }}><Close /></button>
            <div ref={mainRef} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "44px 44px 40px" }}>
              <span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>{current.kind}{pdfTag(current.href)}{current.concept ? ` · ${current.concept}` : ""}</span>
              <h2 className="display" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.15 }}>{current.title}</h2>
              {current.desc && <p style={{ fontSize: 15, lineHeight: 1.7, color: "#4b5569" }}>{current.desc}</p>}
              <div style={{ position: "relative", aspectRatio: "16 / 10", maxHeight: 420, borderRadius: 16, overflow: "hidden", background: "#e6f3fc" }}>{current.img && <img src={current.img} alt="" style={cover} />}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                {current.href
                  ? <a className="btn btn-navy btn-md" href={current.href} {...linkProps(current.href)}>{isDownload(current.href) ? "Download PDF" : "Open resource"}</a>
                  : <button type="button" className="btn btn-navy btn-md" disabled aria-disabled="true" style={{ pointerEvents: "none" }}>PDF coming soon</button>}
              </div>
            </div>
            <nav aria-label="Other resources" className="resource-panel-side" style={{ display: "flex", flexDirection: "column", gap: 18, padding: "56px 18px 28px" }}>
              {sections.map((s) => (
                <div key={s.title} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="eyebrow eyebrow-sm" style={{ padding: "0 12px 6px" }}>{s.title}</span>
                  {s.items.map((r) => (
                    <button key={r.slug} type="button" className="resource-panel-item" aria-current={r.slug === active ? "true" : undefined} onClick={() => open(r.slug)}>
                      <span style={{ width: 48, height: 48, flex: "none", borderRadius: 10, overflow: "hidden", position: "relative", background: "#e6f3fc" }}>{r.img && <img src={r.img} alt="" style={cover} loading="lazy" />}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span className="eyebrow eyebrow-sm" style={{ fontSize: 10 }}>{r.kind}{pdfTag(r.href)}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.title}</span>
                      </span>
                    </button>))}
                </div>))}
            </nav>
          </div>
        </div>
      )}
    </PanelCtx.Provider>
  );
}

/** A resource card: looks and lays out exactly like the plain link it replaces, but a plain click opens the panel.
 *  The real `href` keeps copy-link, middle-click and no-JS working (`?guide=<slug>` opens the same resource on load). */
export function ResourceCardLink({ slug, className, style, children }: { slug: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const ctx = useContext(PanelCtx);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!ctx || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); ctx.open(slug);
  };
  return <a href={`?${PARAM}=${encodeURIComponent(slug)}`} className={className} style={style} onClick={onClick}>{children}</a>;
}
