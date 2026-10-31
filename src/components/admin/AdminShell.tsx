import Link from "next/link";
import { sql, eq, and } from "drizzle-orm";
import { db, leads, ccResources, ccEvents, type User } from "@/lib/db";
import { can, type Area } from "@/lib/auth/session";
import AdminNav from "./AdminNav";

export const ADMIN_NAV: { key: string; label: string; href: string; area: Area }[] = [
  { key: "dash", label: "Dashboard", href: "/admin", area: "dashboard" },
  { key: "leads", label: "Leads", href: "/admin/leads", area: "leads" },
  { key: "projects", label: "Project Pipeline", href: "/admin/projects", area: "projects" },
  { key: "calendar", label: "Calendar", href: "/admin/calendar", area: "calendar" },
  { key: "forms", label: "Form builder", href: "/admin/forms", area: "forms" },
  { key: "cms", label: "Content (CMS)", href: "/admin/content", area: "pages" },
  { key: "hero", label: "Hero editor", href: "/admin/hero", area: "hero" },
  { key: "products", label: "Products", href: "/admin/products", area: "products" },
  { key: "rss", label: "RSS feeds", href: "/admin/rss", area: "rss" },
  { key: "caribbean", label: "Caribbean Connection", href: "/admin/caribbean", area: "caribbean" },
  { key: "social", label: "Social media", href: "/admin/social", area: "social" },
  { key: "ops", label: "Client ops", href: "/admin/ops", area: "ops" },
];

export default async function AdminShell({ user, active, title, subtitle, children, actions }: { user: User; active: string; title: string; subtitle?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const [[nl], [cr], [ce]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(eq(leads.stage, "new"), eq(leads.archived, false))),
    db.select({ n: sql<number>`count(*)` }).from(ccResources).where(eq(ccResources.status, "pending")),
    db.select({ n: sql<number>`count(*)` }).from(ccEvents).where(eq(ccEvents.status, "pending")),
  ]);
  const badges: Record<string, number> = { leads: Number(nl.n), caribbean: Number(cr.n) + Number(ce.n) };
  const items = ADMIN_NAV.filter((n) => can(user, n.area)).map((n) => ({ ...n, badge: badges[n.key] || 0 }));
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 8px" }}><Link href="/admin"><img src="/assets/logo-white-on-dark.png" alt="Grace In Design" style={{ height: 30, width: "auto" }} /></Link><span style={{ fontSize: 11, color: "#8c95a8", letterSpacing: ".08em", textTransform: "uppercase" }}>Site admin</span></div>
        <AdminNav items={items} active={active} />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 12, background: "rgba(255,255,255,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", objectPosition: "center 30%" }} /> : <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#6cb6e6", color: "#1a2238", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</span><span style={{ fontSize: 11, color: "#8c95a8" }}>{user.isSuperAdmin ? "Super admin" : user.role === "owner" ? "Owner · Admin" : user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><Link href="/" style={{ color: "#c6cbd6" }}>← View live site</Link><a href="/auth/signout" style={{ color: "#8c95a8" }}>Sign out</a></div>
        </div>
      </aside>
      <main className="admin-main">
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><h1 className="admin-title">{title}</h1>{subtitle && <span style={{ fontSize: 13, color: "#6b7486" }}>{subtitle}</span>}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <form action="/admin/search" method="get" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 40, borderRadius: 10, background: "#fff", border: "1px solid #e3e6ec", fontSize: 13, color: "#6b7486", width: 260 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input name="q" placeholder="Search leads, products…" style={{ border: 0, outline: 0, background: "transparent", fontSize: 13, width: "100%" }} />
            </form>
            {actions}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
