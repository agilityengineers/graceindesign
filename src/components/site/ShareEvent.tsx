"use client";
import { useEffect, useState } from "react";

/** Share buttons on an event page: copy the link, the phone's own share sheet, or a network of choice. */
export default function ShareEvent({ url, title }: { url: string; title: string }) {
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
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this link:", url); return; }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button type="button" onClick={copy} className="btn btn-ghost btn-sm">{copied ? "Link copied" : "Copy link"}</button>
      {canShare && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigator.share({ title, url }).catch(() => {})}>Share…</button>}
      {links.map(([label, href]) => <a key={label} href={href} target={label === "Email" ? undefined : "_blank"} rel="noreferrer" className="btn btn-ghost btn-sm">{label}</a>)}
    </div>
  );
}
