import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, services, paths } from "@/lib/db";
import { serviceHref } from "@/lib/data/site";
import AdminShell from "@/components/admin/AdminShell";
import { Card, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import ContentTabs from "@/components/admin/ContentTabs";
import { serviceAction, reorderServices } from "@/lib/actions/content";

export const metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesAdmin() {
  const user = await requireArea("services");
  const [rows, pathRows] = await Promise.all([db.select().from(services).orderBy(asc(services.sort), asc(services.id)), db.select({ id: paths.id, label: paths.label }).from(paths)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return (
    <AdminShell user={user} active="cms" title="Services" subtitle="Add, edit, reorder or nest services; each gets a landing page, form path and hero" actions={<ContentTabs active="services" />}>
      <Toast />
      <Card title="Services" sub="Drag to reorder the navigation and the Services page" action={<Link href="/admin/content/services/new" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>+ New service</Link>}>
        <Sortable ids={rows.map((r) => r.id)} onReorder={reorderServices}>
          {rows.map((s) => { const parent = s.parentId ? byId.get(s.parentId) : null; return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr) 1fr auto", gap: 14, alignItems: "center", padding: "12px 14px", borderRadius: 12, border: "1px solid #eef0f4", background: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}><span style={{ fontWeight: 600, fontSize: 14 }}>{parent ? <span style={{ color: "#8c95a8" }}>{parent.title} › </span> : null}{s.title}</span><a href={serviceHref(s.slug, parent?.slug)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#3f9ad9" }}>{serviceHref(s.slug, parent?.slug)}</a></div>
              <div style={{ fontSize: 12, color: "#6b7486", display: "flex", flexDirection: "column", gap: 2 }}><span>Form path: <strong style={{ color: "#1a2238" }}>{pathRows.find((p) => p.id === s.pathId)?.label || "— none"}</strong></span><span>Hero: <strong style={{ color: "#1a2238", textTransform: "capitalize" }}>{s.heroStyle}</strong> · nav: {s.navGroup}</span></div>
              <StatusPill status={s.status} />
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Link href={`/admin/content/services/${s.id}`} className="link-btn">Edit</Link>
                <Link href={`/admin/hero?page=${s.slug}`} className="link-btn link-muted">Hero</Link>
                <form action={serviceAction}><input type="hidden" name="serviceId" value={s.id} /><input type="hidden" name="op" value={s.status === "published" ? "unpublish" : "publish"} /><button type="submit" className="link-btn link-muted">{s.status === "published" ? "Unpublish" : "Publish"}</button></form>
                <form action={serviceAction}><input type="hidden" name="serviceId" value={s.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${s.title}” and its landing page? Child services become top-level.`}>Delete</ConfirmButton></form>
              </div>
            </div>); })}
        </Sortable>
      </Card>
    </AdminShell>
  );
}
