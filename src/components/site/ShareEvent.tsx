"use client";
import { useEffect, useState } from "react";

/** Tell the site about a view or a share (src/lib/event-stats.ts). Fire-and-forget: it never delays or breaks the page. */
function report(slug: string, kind: "view" | "share") {
  try { void fetch(`/api/events/${encodeURIComponent(slug)}/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }), keepalive: true }).catch(() => {}); } catch { /* ignore */ }
}

/** Counts one view per browser tab session, so refreshing or coming back to the tab doesn't inflate the number. Renders nothing. */
export function EventViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `gid-event-view:${slug}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* storage blocked: still count */ }
    report(slug, "view");
  }, [slug]);
  return null;
}

/** Share buttons on an event page: copy the link, the phone's own share sheet, or a network of choice. Each use is counted as a share. */
export default function ShareEvent({ url, title, slug }: { url: string; title: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false); // known only in the browser; set after mount so server and client render alike
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const links: [string, string][] = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["WhatsApp", `https://wa.me/?text=${t}%20${u}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["X", `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
    ["Email", `mailto:?subject=${t}&body=${t}%0A%0A${u}`],
  ];
  const copy = async () => {
    report(slug, "share");
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this link:", url); return; }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={copy} className="btn btn-ghost btn-sm">{copied ? "Link copied" : "Copy link"}</button>
      {canShare && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { report(slug, "share"); navigator.share({ title, url }).catch(() => {}); }}>Share…</button>}
      {links.map(([label, href]) => <a key={label} href={href} onClick={() => report(slug, "share")} target={label === "Email" ? undefined : "_blank"} rel="noreferrer" className="btn btn-ghost btn-sm">{label}</a>)}
    </div>
  );
}
