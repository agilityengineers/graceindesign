import Link from "next/link";
import { desc, ilike, or } from "drizzle-orm";
import { requireUser, can } from "@/lib/auth/session";
import { db, leads, projects, products, posts, ccResources, pages, services } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card, StagePill } from "@/components/admin/ui";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams; const like = `%${q.trim()}%`;
  const empty = !q.trim();
  const [L, P, PR, PO, R, PG, SV] = empty ? [[], [], [], [], [], [], []] : await Promise.all([
    can(user, "leads") ? db.select().from(leads).where(or(ilike(leads.name, like), ilike(leads.email, like), ilike(leads.phone, like), ilike(leads.company, like))).orderBy(desc(leads.createdAt)).limit(20) : [],
    can(user, "projects") ? db.select().from(projects).where(or(ilike(projects.name, like), ilike(projects.code, like), ilike(projects.leadName, like), ilike(projects.address, like))).limit(20) : [],
    can(user, "products") ? db.select().from(products).where(or(ilike(products.title, like), ilike(products.category, like))).limit(20) : [],
    can(user, "posts") ? db.select().from(posts).where(or(ilike(posts.title, like), ilike(posts.excerpt, like))).limit(20) : [],
    can(user, "caribbean") ? db.select().from(ccResources).where(or(ilike(ccResources.name, like), ilike(ccResources.description, like))).limit(20) : [],
    can(user, "pages") ? db.select().from(pages).where(or(ilike(pages.title, like), ilike(pages.key, like))).limit(20) : [],
    can(user, "services") ? db.select().from(services).where(or(ilike(services.title, like), ilike(services.slug, like))).limit(20) : [],
  ]);
  const total = L.length + P.length + PR.length + PO.length + R.length + PG.length + SV.length;
  const Row = ({ href, title, sub, right }: { href: string; title: string; sub?: string; right?: React.ReactNode }) => <Link href={href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f2f4f7", color: "#1a2238", fontSize: 13 }}><span style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 600 }}>{title}</span>{sub && <span style={{ fontSize: 12, color: "#6b7486" }}>{sub}</span>}</span>{right}</Link>;
  return (
    <AdminShell user={user} active="" title={empty ? "Search" : `Results for “${q}”`} subtitle={empty ? "Search leads, projects, products, posts, pages and directory listings" : `${total} match${total === 1 ? "" : "es"}`}>
      {L.length > 0 && <Card title="Leads">{L.map((l) => <Row key={l.id} href={`/admin/leads?open=${l.id}`} title={l.name} sub={`${l.email || ""} · ${l.sourceLabel || l.sourcePage}`} right={<StagePill stage={l.stage} />} />)}</Card>}
      {P.length > 0 && <Card title="Projects">{P.map((p) => <Row key={p.id} href={`/admin/projects?open=${p.id}`} title={p.name} sub={`${p.code} · ${p.serviceName || ""}`} />)}</Card>}
      {PR.length > 0 && <Card title="Products">{PR.map((p) => <Row key={p.id} href="/admin/products" title={p.title} sub={`${p.category} · ${p.price}`} />)}</Card>}
      {PO.length > 0 && <Card title="Posts">{PO.map((p) => <Row key={p.id} href={`/admin/content/posts/${p.id}`} title={p.title} sub={`${p.category} · ${p.status}`} />)}</Card>}
      {PG.length > 0 && <Card title="Pages">{PG.map((p) => <Row key={p.id} href={`/admin/content?page=${p.key}`} title={p.title} sub={p.slug} />)}</Card>}
      {SV.length > 0 && <Card title="Services">{SV.map((s) => <Row key={s.id} href={`/admin/content/services/${s.id}`} title={s.title} sub={`/services/${s.slug}`} />)}</Card>}
      {R.length > 0 && <Card title="Caribbean directory">{R.map((r) => <Row key={r.id} href="/admin/caribbean?tab=resources&filter=All" title={r.name} sub={`${r.category} · ${r.country} · ${r.status}`} />)}</Card>}
      {!empty && total === 0 && <Card>No matches. Try a name, email, project code or title.</Card>}
    </AdminShell>
  );
}
