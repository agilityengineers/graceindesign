import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, services, paths } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ContentTabs from "@/components/admin/ContentTabs";
import { saveService } from "@/lib/actions/content";

export const dynamic = "force-dynamic";
const t2 = (rows: [string, string][] | null | undefined) => (rows || []).map((r) => r.join(" | ")).join("\n");
const t3 = (rows: [string, string, string][] | null | undefined) => (rows || []).map((r) => r.join(" | ")).join("\n");

export default async function ServiceEdit({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireArea("services");
  const { id } = await params;
  const isNew = id === "new";
  const [all, pathRows, map] = await Promise.all([db.select().from(services).orderBy(asc(services.sort)), db.select({ id: paths.id, label: paths.label }).from(paths).orderBy(asc(paths.sort)), getMediaMap()]);
  const s = isNew ? null : all.find((x) => x.id === Number(id));
  if (!isNew && !s) notFound();
  const F = ({ label, name, value, span, rows, hint, type = "text" }: { label: string; name: string; value?: string | null; span?: boolean; rows?: number; hint?: string; type?: string }) => (
    <label className="label label-caps" style={{ gridColumn: span ? "1/-1" : undefined }}>{label}{hint && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#8c95a8" }}> · {hint}</span>}{rows ? <textarea name={name} rows={rows} defaultValue={value || ""} className="admin-input" /> : <input name={name} type={type} defaultValue={value || ""} className="admin-input admin-input-sm" />}</label>
  );
  return (
    <AdminShell user={user} active="cms" title={isNew ? "New service" : s!.title} subtitle={isNew ? "Creates a landing page, nav entry and form path mapping" : `/services/${s!.slug}`} actions={<ContentTabs active="services" />}>
      <Toast />
      <form action={saveService} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {!isNew && <input type="hidden" name="serviceId" value={s!.id} />}
        <Card title="Basics">
          <div className="g2" style={{ gap: 12 }}>
            <F label="Title" name="title" value={s?.title} />
            <F label="Slug" name="slug" value={s?.slug} hint="lowercase, hyphens" />
            <F label="Kicker (eyebrow)" name="kicker" value={s?.kicker} />
            <label className="label label-caps">Parent service<select name="parentId" defaultValue={s?.parentId ?? ""} className="admin-input admin-input-sm"><option value="">— top level —</option>{all.filter((x) => x.id !== s?.id && !x.parentId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
            <label className="label label-caps">Form path (audience)<select name="pathId" defaultValue={s?.pathId ?? ""} className="admin-input admin-input-sm"><option value="">— generic form —</option>{pathRows.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            <label className="label label-caps">Navigation group<select name="navGroup" defaultValue={s?.navGroup || "services"} className="admin-input admin-input-sm"><option value="services">Services menu</option><option value="hhr">Healthy Home Resources</option><option value="hidden">Hidden (direct link only)</option></select></label>
            <label className="label label-caps">Status<select name="status" defaultValue={s?.status || "published"} className="admin-input admin-input-sm"><option value="published">Published</option><option value="draft">Draft (hidden)</option></select></label>
            <F label="CTA button text" name="cta" value={s?.cta || "Start a Project"} />
          </div>
        </Card>
        <Card title="Landing page copy" sub="The StoryBrand sections every service page renders">
          <div className="g2" style={{ gap: 12 }}>
            <F label="Headline (classic hero)" name="hero" value={s?.hero} span />
            <F label="Intro" name="sub" value={s?.sub} span rows={2} />
            <F label="The problem" name="problem" value={s?.problem} rows={3} />
            <F label="Empathy" name="empathy" value={s?.empathy} rows={3} />
            <F label="Authority" name="authority" value={s?.authority} span rows={2} />
            <F label="The plan" name="plan" value={t2(s?.plan)} rows={4} hint="one step per line: Title | Detail" />
            <F label="Success looks like" name="success" value={(s?.success || []).join("\n")} rows={4} hint="one per line" />
            <F label="Without it (failure)" name="failure" value={s?.failure} span rows={2} />
            <F label="Features" name="features" value={t2(s?.features)} rows={4} hint="Title | Detail per line" span />
            <F label="Tiers title" name="tiersTitle" value={s?.tiersTitle} />
            <F label="Tiers subtitle" name="tiersSub" value={s?.tiersSub} />
            <F label="Tiers" name="tiers" value={t3(s?.tiers)} rows={3} hint="Name | Price | Detail per line (blank = no tiers)" span />
            <F label="Process steps" name="steps" value={(s?.steps || []).join("\n")} rows={3} hint="one per line (blank = default)" span />
            <F label="Testimonial quote" name="testimonialQuote" value={s?.testimonialQuote} rows={2} />
            <F label="Testimonial attribution" name="testimonialWho" value={s?.testimonialWho} />
          </div>
        </Card>
        <Card title="Images & SEO">
          <div className="g2" style={{ gap: 12 }}>
            {(["img", "img2"] as const).map((k) => (
              <div key={k} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 120, height: 80, borderRadius: 10, overflow: "hidden", background: "#f2f4f7", flex: "none" }}>{s?.[k] && <img src={resolveImg(map, s[k])} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}><F label={k === "img" ? "Primary photo" : "Secondary photo"} name={k} value={s?.[k]} hint="media://slot or URL" /><input type="file" name={`${k}_file`} accept="image/*" style={{ fontSize: 11 }} /></div>
              </div>))}
            <F label="Meta title" name="seoTitle" value={s?.seoTitle} />
            <F label="Meta description" name="seoDescription" value={s?.seoDescription} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#6b7486" }}>Cinematic scenes, headline lead/tail and before/after live in the <Link href={s ? `/admin/hero?page=${s.slug}` : "/admin/hero"} style={{ color: "#3f9ad9" }}>Hero editor</Link>.</span>
            <div style={{ display: "flex", gap: 10 }}><Link href="/admin/content/services" className="btn btn-ghost btn-sm" style={{ borderRadius: 10 }}>Cancel</Link><button type="submit" className="btn btn-navy btn-sm" style={{ borderRadius: 10 }}>{isNew ? "Create service" : "Save service"}</button></div>
          </div>
        </Card>
      </form>
    </AdminShell>
  );
}
