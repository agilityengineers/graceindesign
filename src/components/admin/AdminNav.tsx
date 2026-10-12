"use client";
import Link from "next/link";
export default function AdminNav({ items, active }: { items: { key: string; label: string; href: string; badge: number }[]; active: string }) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Admin">
      {items.map((n) => (
        <Link key={n.key} href={n.href} className={`admin-nav-item${active === n.key ? " is-active" : ""}`}><span className="dot" />{n.label}{n.badge > 0 && <span className="badge" style={{ marginLeft: "auto" }}>{n.badge}</span>}</Link>
      ))}
    </nav>
  );
}
