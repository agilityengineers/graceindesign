import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, teamMembers } from "@/lib/db";
import { getMediaMap, resolveImg } from "@/lib/data/media";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { saveTeamMember, deleteTeamMember } from "@/lib/actions/content";

export const metadata = { title: "About & team" };
export const dynamic = "force-dynamic";

export default async function TeamAdmin() {
  const user = await requireArea("pages");
  const [rows, map] = await Promise.all([db.select().from(teamMembers).orderBy(asc(teamMembers.sort), asc(teamMembers.id)), getMediaMap()]);
  const Form = ({ m }: { m?: typeof rows[number] }) => (
    <form action={saveTeamMember} encType="multipart/form-data" style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 12 }}>
      {m && <input type="hidden" name="memberId" value={m.id} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ width: 160, height: 200, borderRadius: 12, overflow: "hidden", background: "#f2f4f7" }}>{m?.photoUrl && <img src={resolveImg(map, m.photoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />}</div>
        <label className="link-btn" style={{ cursor: "pointer" }}>Replace photo<input type="file" name="photo_file" accept="image/*" hidden /></label>
        <input type="hidden" name="photoUrl" value={m?.photoUrl || ""} />
      </div>
      <label className="label label-caps">Name<input name="name" defaultValue={m?.name || ""} className="admin-input admin-input-sm" required /></label>
      <label className="label label-caps">Title<input name="title" defaultValue={m?.title || ""} className="admin-input admin-input-sm" placeholder="Founder & Principal Designer" /></label>
      <label className="label label-caps" style={{ gridColumn: "2/-1" }}>Credentials (one line)<input name="credentials" defaultValue={m?.credentials || ""} className="admin-input admin-input-sm" placeholder="Registered Interior Designer · WELL AP · CAPS" /></label>
      <label className="label label-caps" style={{ gridColumn: "2/-1" }}>Quote<textarea name="quote" rows={2} defaultValue={m?.quote || ""} className="admin-input" /></label>
      <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Bio<textarea name="bio" rows={4} defaultValue={m?.bio || ""} className="admin-input" /></label>
      <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Bio (second paragraph)<textarea name="bio2" rows={3} defaultValue={m?.bio2 || ""} className="admin-input" /></label>
      <label className="label label-caps" style={{ gridColumn: "1/2" }}>Education (one per line)<textarea name="education" rows={3} defaultValue={(m?.education || []).join("\n")} className="admin-input" /></label>
      <label className="label label-caps" style={{ gridColumn: "2/-1" }}>Credential list (one per line)<textarea name="credentialList" rows={3} defaultValue={(m?.credentialList || []).join("\n")} className="admin-input" /></label>
      <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="visible" defaultChecked={m ? m.visible : true} />Shown on the About page</label>
        <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>{m ? "Save changes" : "+ Add team member"}</button>
      </div>
    </form>
  );
  return (
    <AdminShell user={user} active="cms" title="About & team" subtitle="Founder bio, credentials and company story" actions={<ContentTabs active="team" />}>
      <Toast />
      {rows.map((m) => <Card key={m.id} title={m.name} sub={m.title} action={<form action={deleteTeamMember}><input type="hidden" name="memberId" value={m.id} /><ConfirmButton message={`Remove ${m.name} from the site?`}>Remove</ConfirmButton></form>}><Form m={m} /></Card>)}
      <details><summary style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#3f9ad9" }}>+ Add another team member</summary><Card style={{ marginTop: 12 }}><Form /></Card></details>
      <Card title="Company story"><span style={{ fontSize: 13, color: "#4b5569" }}>The About page intro, credentials chips and story sections are blocks — edit them under <a href="/admin/content?page=about" style={{ color: "#3f9ad9", fontWeight: 600 }}>Pages → About</a>.</span></Card>
    </AdminShell>
  );
}
