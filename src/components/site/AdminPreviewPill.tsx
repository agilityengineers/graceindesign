"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Visible to signed-in admins only: toggles the hero style for this page and persists it. */
export default function AdminPreviewPill({ kind, id, style }: { kind: "page" | "service"; id: string; style: "classic" | "cinematic" }) {
  const [cur, setCur] = useState(style);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isC = cur === "cinematic";
  const toggle = () => {
    const next = isC ? "classic" : "cinematic";
    setCur(next);
    start(async () => {
      await fetch("/api/admin/hero-style", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, style: next }) });
      router.refresh();
    });
  };
  return (
    <div className="admin-preview-pill">
      <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#c6cbd6", flex: "none" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6cb6e6" }} />Admin preview · Hero style</span>
      <button type="button" onClick={toggle} disabled={pending} aria-label="Toggle hero style" style={{ position: "relative", display: "flex", alignItems: "center", width: 188, flex: "none", height: 34, borderRadius: 999, background: "rgba(255,255,255,.1)", padding: 3, border: 0, cursor: "pointer", color: "#fff" }}>
        <span style={{ position: "absolute", top: 3, left: isC ? "50%" : 3, width: "calc(50% - 3px)", height: 28, borderRadius: 999, background: "#6cb6e6", transition: "left .3s cubic-bezier(.22,.61,.36,1)" }} />
        <span style={{ position: "relative", flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: isC ? "#c6cbd6" : "#1a2238" }}>Classic</span>
        <span style={{ position: "relative", flex: 1, textAlign: "center", fontSize: 12, fontWeight: 600, color: isC ? "#1a2238" : "#c6cbd6" }}>Cinematic</span>
      </button>
      <Link href={`/admin/hero?page=${encodeURIComponent(id)}`} style={{ flex: "none", padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontSize: 12, fontWeight: 600 }}>Edit in admin</Link>
    </div>
  );
}
