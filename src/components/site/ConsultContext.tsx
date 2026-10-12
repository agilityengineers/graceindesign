"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Close } from "@/components/ui/Icons";

const ConsultForm = dynamic(() => import("./ConsultForm"), { ssr: false, loading: () => <div style={{ padding: 60, textAlign: "center", color: "#6b7486", background: "#fff", borderRadius: 20 }}>Loading…</div> });

type Ctx = { open: (sourceKey?: string) => void; close: () => void };
const ConsultCtx = createContext<Ctx>({ open: () => {}, close: () => {} });
export const useConsult = () => useContext(ConsultCtx);

export function ConsultProvider({ children, defaultSource }: { children: ReactNode; defaultSource: string }) {
  const [source, setSource] = useState<string | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = useCallback((k?: string) => { lastFocus.current = document.activeElement as HTMLElement; setSource(k || defaultSource); }, [defaultSource]);
  const close = useCallback(() => { setSource(null); setTimeout(() => lastFocus.current?.focus?.(), 0); }, []);

  useEffect(() => {
    if (!source) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button, a, input")?.focus(), 50);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [source, close]);

  return (
    <ConsultCtx.Provider value={{ open, close }}>
      {children}
      {source && (
        <div className="modal-backdrop" onClick={close} role="presentation">
          <div ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-label="Schedule a consultation" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={close} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(26,34,56,.2)", cursor: "pointer" }}><Close /></button>
            <ConsultForm sourcePage={source} inModal onBooked={() => {}} />
          </div>
        </div>
      )}
    </ConsultCtx.Provider>
  );
}

export function ConsultButton({ sourceKey, className, children, style }: { sourceKey?: string; className?: string; children: ReactNode; style?: React.CSSProperties }) {
  const { open } = useConsult();
  return <button type="button" className={className} style={style} onClick={() => open(sourceKey)}>{children}</button>;
}
