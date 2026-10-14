import { asc } from "drizzle-orm";
import { requireArea, can } from "@/lib/auth/session";
import { db, users, integrations, USER_ROLES, USER_ROLE_LABELS } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Avatar, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { saveContactSettings, saveSocialLinks, removeSocialLink, inviteUser, updateUser, integrationAction, integrationLiveStatus } from "@/lib/actions/settings";
import { relativeDay } from "@/lib/utils";

export const metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";
const ENV_HINTS: Record<string, string> = { sendgrid: "SENDGRID_API_KEY, EMAIL_FROM_NOREPLY / _SUPPORT / _CONSULTATION / _NEWSLETTER", twilio: "via Call Flow Tracker: CFT_URL, CFT_MASTER_DASHBOARD_SECRET, CFT_SMS_FROM — or direct: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER", cft: "CFT_URL, CFT_MASTER_DASHBOARD_SECRET (sign-in + SMS), CFT_WEBHOOK_SECRET (events), CFT_SSO_SECRET (CFT → here)", slack: "SLACK_WEBHOOK_URL (Slack → Apps → Incoming Webhooks)", etsy: "none — listings are read from public pages (ETSY_API_KEY optional)", rss: "none", magnific: "MAGNIFIC_API_KEY", meta: "META_APP_ID, META_APP_SECRET + connect under Social media", linkedin: "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET", pinterest: "PINTEREST_APP_ID, PINTEREST_APP_SECRET", youtube: "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET", stripe: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET", esign: "built-in click-to-sign; DROPBOX_SIGN_API_KEY optional", hubspot: "HUBSPOT_ACCESS_TOKEN" };

export default async function SettingsAdmin() {
  const user = await requireArea("pages");
  const [s, team, ints] = await Promise.all([getSettings(["contact", "footer", "social_links", "seo"]), db.select().from(users).orderBy(asc(users.name)), db.select().from(integrations).orderBy(asc(integrations.phase), asc(integrations.id))]);
  const live = await Promise.all(ints.map((i) => integrationLiveStatus(i.key)));
  const manageUsers = can(user, "users");
  return (
    <AdminShell user={user} active="cms" title="Site settings" subtitle="Contact details, footer, social links, team access and integrations" actions={<ContentTabs active="settings" />}>
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Contact & footer">
          <form action={saveContactSettings} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="label label-caps">Phone<input name="phone" defaultValue={s.contact.phone} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Email<input name="email" defaultValue={s.contact.email} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Hours<input name="hours" defaultValue={s.contact.hours} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Consultations note<input name="consultationsNote" defaultValue={s.contact.consultationsNote} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Address<input name="address" defaultValue={s.contact.address} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Second line (city, state or service area)<input name="addressLine2" defaultValue={s.contact.addressLine2} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Utility-bar credential (homepage)<input name="utilityLabel" defaultValue={s.contact.utilityLabel} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Footer blurb<textarea name="blurb" rows={3} defaultValue={s.footer.blurb} className="admin-input" /></label>
            <label className="label label-caps">Copyright line<input name="copyright" defaultValue={s.footer.copyright} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Site name (SEO)<input name="siteName" defaultValue={s.seo.siteName} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Default meta description<textarea name="defaultDescription" rows={2} defaultValue={s.seo.defaultDescription} className="admin-input" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>Save</button>
          </form>
        </Card>
        <Card title="Social links & icons" sub="Shown in the footer">
          <form action={saveSocialLinks} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {s.social_links.map((l, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, alignItems: "center" }}><input name="name" defaultValue={l.name} className="admin-input admin-input-sm" /><input name="url" defaultValue={l.url} className="admin-input admin-input-sm" /><label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="enabled" value={i} defaultChecked={l.enabled} />on</label></div>)}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 8, alignItems: "center", borderTop: "1px solid #eef0f4", paddingTop: 8 }}><input name="newName" placeholder="Network" className="admin-input admin-input-sm" /><input name="newUrl" placeholder="https://" className="admin-input admin-input-sm" /><span style={{ fontSize: 11, color: "#8c95a8" }}>+ Add network</span></div>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save links</button>
          </form>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{s.social_links.map((l, i) => <form key={i} action={removeSocialLink}><input type="hidden" name="index" value={i} /><ConfirmButton message={`Remove ${l.name}?`}>Remove {l.name}</ConfirmButton></form>)}</div>
        </Card>
      </div>
      <Card title="Users & roles" sub="Owner — everything · Editor — CMS only · Sales — leads & calendar · Social manager — social & posts">
        {team.map((u) => (
          <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid #f2f4f7", opacity: u.isActive ? 1 : .55 }}>
            <form action={updateUser} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1.4fr) minmax(0, 1.6fr) 150px 150px auto", gap: 10, alignItems: "center" }}>
              <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="update" /><input type="hidden" name="superForm" value="1" />
              <Avatar name={u.name} />
              <input name="name" defaultValue={u.name} className="admin-input admin-input-sm" disabled={!manageUsers} aria-label="Name" />
              <span style={{ fontSize: 12, color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}{u.lastLoginAt ? ` · last sign-in ${relativeDay(u.lastLoginAt)}` : " · never signed in"}</span>
              <select name="role" defaultValue={u.role} className="admin-input admin-input-sm" disabled={!manageUsers} aria-label="Role">{USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}</select>
              <input name="title" defaultValue={u.title || ""} placeholder="Title" className="admin-input admin-input-sm" disabled={!manageUsers} aria-label="Title" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>{user.isSuperAdmin && <label style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="isSuperAdmin" defaultChecked={u.isSuperAdmin} disabled={u.id === user.id} />Super</label>}{!user.isSuperAdmin && u.isSuperAdmin && <span className="tag">Super admin</span>}{manageUsers && <button type="submit" className="link-btn">Save</button>}</div>
            </form>
            {manageUsers && u.id !== user.id && (
              <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
                <form action={updateUser}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="resend" /><button type="submit" className="link-btn link-muted">Resend sign-in link</button></form>
                <form action={updateUser}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="signout" /><button type="submit" className="link-btn link-muted">Sign out everywhere</button></form>
                <form action={updateUser}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value={u.isActive ? "deactivate" : "activate"} /><button type="submit" className="link-btn link-muted">{u.isActive ? "Deactivate" : "Reactivate"}</button></form>
                <form action={updateUser}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete ${u.name}'s account? Their activity history stays attributed.`}>Delete</ConfirmButton></form>
              </div>)}
          </div>))}
        {manageUsers && (
          <form action={inviteUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 150px 1fr auto", gap: 8, alignItems: "end", paddingTop: 8 }}>
            <label className="label label-caps">Name<input name="name" className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Email<input name="email" type="email" className="admin-input admin-input-sm" required /></label>
            <label className="label label-caps">Role<select name="role" className="admin-input admin-input-sm" defaultValue="editor">{USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}</select></label>
            <label className="label label-caps">Title<input name="title" className="admin-input admin-input-sm" /></label>
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, height: 34 }}>+ Invite user</button>
          </form>)}
      </Card>
      <Card title="Integrations" sub="Secrets live in Replit → Secrets (never in the database). Re-check after adding one.">
        {ints.map((i, idx) => (
          <div key={i.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr) 90px 120px auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f2f4f7", fontSize: 13 }}>
            <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontWeight: 600 }}>{i.name}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{i.purpose}</span></div>
            <span style={{ fontSize: 11, color: "#6b7486" }}>Needs: {ENV_HINTS[i.key] || "—"}</span>
            <span className="tag" style={{ justifySelf: "start", background: "#e9e4fb", color: "#4a2fa3" }}>PHASE {i.phase}</span>
            <StatusPill status={live[idx]} />
            <form action={integrationAction}><input type="hidden" name="key" value={i.key} /><input type="hidden" name="op" value="check" /><button type="submit" className="link-btn" disabled={!can(user, "integrations")}>Re-check</button></form>
          </div>))}
      </Card>
    </AdminShell>
  );
}
