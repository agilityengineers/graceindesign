import { asc } from "drizzle-orm";
import { requireArea, can } from "@/lib/auth/session";
import { db, users, integrations, USER_ROLES, USER_ROLE_LABELS } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Avatar, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ContentTabs from "@/components/admin/ContentTabs";
import { saveContactSettings, saveSocialLinks, removeSocialLink, inviteUser, updateUser, integrationAction, integrationLiveStatus, saveAmazonSettings, saveGoogleSettings } from "@/lib/actions/settings";
import { env } from "@/lib/env";
import { relativeDay } from "@/lib/utils";
import { ensureInstaIntegrationRow } from "@/lib/server/insta-newsletter";
import { reviewUrl, trackedProfileWebsiteUrl } from "@/lib/google";

export const metadata = { title: "Site settings" };
export const dynamic = "force-dynamic";
const ENV_HINTS: Record<string, string> = { insta_newsletter: "INSTA_NEWSLETTER_URL + INSTA_NEWSLETTER_API_KEY, or paste the key under Admin → Newsletter → Insta-Newsletter", sendgrid: "SENDGRID_API_KEY, EMAIL_FROM_NOREPLY / _SUPPORT / _CONSULTATION / _NEWSLETTER", twilio: "via Call Flow Tracker: CFT_URL, CFT_MASTER_DASHBOARD_SECRET, CFT_SMS_FROM — or direct: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER", cft: "CFT_URL, CFT_MASTER_DASHBOARD_SECRET (sign-in + SMS), CFT_WEBHOOK_SECRET (events), CFT_SSO_SECRET (CFT → here)", slack: "SLACK_WEBHOOK_URL (Slack → Apps → Incoming Webhooks)", etsy: "none — listings are read from public pages (ETSY_API_KEY optional)", amazon: "AMAZON_ASSOCIATE_TAG (or Site settings → Amazon shop); AMAZON_PAAPI_ACCESS_KEY + AMAZON_PAAPI_SECRET_KEY for Amazon search and live prices", rss: "none", magnific: "MAGNIFIC_API_KEY", meta: "META_APP_ID, META_APP_SECRET + connect under Social media", linkedin: "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET", pinterest: "PINTEREST_APP_ID, PINTEREST_APP_SECRET", youtube: "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET", stripe: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET", esign: "built-in click-to-sign; DROPBOX_SIGN_API_KEY optional", hubspot: "HUBSPOT_ACCESS_TOKEN" };

export default async function SettingsAdmin() {
  const user = await requireArea("pages");
  await ensureInstaIntegrationRow();
  const [s, team, ints] = await Promise.all([getSettings(["contact", "footer", "social_links", "seo", "amazon", "google"]), db.select().from(users).orderBy(asc(users.name)), db.select().from(integrations).orderBy(asc(integrations.phase), asc(integrations.id))]);
  const live = await Promise.all(ints.map((i) => integrationLiveStatus(i.key)));
  const manageUsers = can(user, "users");
  const g = s.google;
  const gaEnvFallback = !g.gaMeasurementId && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID : "";
  const site = env.baseUrl.replace(/\/$/, "");
  const siteIsLocal = /localhost|127\.0\.0\.1/.test(site);
  const status = [
    { done: !!(g.gaMeasurementId || gaEnvFallback), label: "Google Analytics" },
    { done: !!g.searchConsoleToken, label: "Search Console verification" },
    { done: !!g.profileUrl, label: "Business Profile link" },
    { done: !!g.placeId, label: "Place ID (review link)" },
    { done: !!g.mapEmbedUrl, label: "Map for the Google map block" },
  ];
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
      <Card title="Amazon shop" sub="Your Associates tracking id goes on every Amazon product link and powers the “Add to Amazon cart” buttons on product cards. Product shelves can be placed on any page in Content → Pages.">
        <form action={saveAmazonSettings} style={{ display: "grid", gridTemplateColumns: "minmax(0, 320px) auto auto", gap: 14, alignItems: "end" }}>
          <label className="label label-caps">Associates tracking id<input name="associateTag" defaultValue={s.amazon.associateTag} placeholder={env.amazon.partnerTag || "e.g. graceindesign-20"} className="admin-input admin-input-sm" /></label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, height: 34 }}><input type="checkbox" name="cartButtons" defaultChecked={s.amazon.cartButtons} />Show “Add to Amazon cart” buttons</label>
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save</button>
        </form>
        <p style={{ fontSize: 12, color: "#6b7486", margin: 0 }}>{env.amazon.accessKey && env.amazon.secretKey ? "Product Advertising API keys are set: Admin → Products can search Amazon, and prices and ratings refresh through the API." : "Searching Amazon from the admin and live prices need the Product Advertising API keys in Replit → Secrets (see Integrations). Pasting product links works without them."}</p>
      </Card>
      <Card title="Google & SEO" sub="Analytics, Search Console and your Google Business Profile. Changes go live on the public site as soon as you save — no republish needed.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{status.map((x) => <span key={x.label} className="tag" style={{ background: x.done ? "#e3f4ea" : "#f2f4f7", color: x.done ? "#1f7a46" : "#6b7486" }}>{x.done ? "✓" : "○"} {x.label}</span>)}</div>
        {siteIsLocal && <p style={{ fontSize: 12, color: "#a23b2a", margin: 0 }}>BASE_URL in Replit → Secrets is not your live domain yet ({site}). Set it to your real address (e.g. https://graceindesign.net) and republish, or Google will be sent to the wrong sitemap.</p>}
        <form action={saveGoogleSettings} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <legend className="label-caps" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Analytics & verification</legend>
            <label className="label label-caps">GA4 Measurement ID<input name="gaMeasurementId" defaultValue={g.gaMeasurementId} placeholder={gaEnvFallback || "G-XXXXXXXXXX"} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Tag Manager container (optional)<input name="gtmContainerId" defaultValue={g.gtmContainerId} placeholder="GTM-XXXXXXX" className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Search Console verification (HTML tag)<input name="searchConsoleToken" defaultValue={g.searchConsoleToken} placeholder={'<meta name="google-site-verification" content="…" /> — paste the whole tag or just the code'} className="admin-input admin-input-sm" /></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, gridColumn: "1/-1" }}><input type="checkbox" name="excludeTeam" defaultChecked={g.excludeTeam} />Don’t count visits from signed-in team members</label>
            <p style={{ fontSize: 11.5, color: "#6b7486", margin: 0, gridColumn: "1/-1" }}>{gaEnvFallback ? `Analytics is currently using ${gaEnvFallback} from Replit Secrets; an ID saved here takes over. ` : ""}Use either the GA4 ID or a Tag Manager container that loads GA4 — not both, or visits are counted twice. Analytics only runs on public pages, never on admin, client portal, proposal or booking links.</p>
          </fieldset>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <legend className="label-caps" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Google Business Profile</legend>
            <label className="label label-caps">Profile link (Share → copy link)<input name="profileUrl" defaultValue={g.profileUrl} placeholder="https://maps.app.goo.gl/…" className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">Place ID<input name="placeId" defaultValue={g.placeId} placeholder="ChIJ…" className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Map embed (Google Maps → Share → Embed a map → copy HTML)<input name="mapEmbedUrl" defaultValue={g.mapEmbedUrl} placeholder={'<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>'} className="admin-input admin-input-sm" /></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, gridColumn: "1/-1" }}><input type="checkbox" name="footerReviewLink" defaultChecked={g.footerReviewLink} />Show “Review us on Google” in the site footer (needs the Place ID)</label>
          </fieldset>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gridTemplateColumns: "2fr 1fr 70px 100px", gap: 10 }}>
            <legend className="label-caps" style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Business details for search engines — match your Business Profile exactly</legend>
            <label className="label label-caps">Street address<input name="streetAddress" defaultValue={g.streetAddress} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">City<input name="city" defaultValue={g.city} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">State<input name="region" defaultValue={g.region} className="admin-input admin-input-sm" /></label>
            <label className="label label-caps">ZIP<input name="postalCode" defaultValue={g.postalCode} className="admin-input admin-input-sm" /></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, gridColumn: "1/-1" }}><input type="checkbox" name="hideStreet" defaultChecked={g.hideStreet} />Keep the street address private (choose this if your Business Profile hides it as a service-area business)</label>
            <label className="label label-caps" style={{ gridColumn: "1/3" }}>Areas served (comma separated)<input name="areaServed" defaultValue={g.areaServed} placeholder="Metro Atlanta, Marietta, Decatur" className="admin-input admin-input-sm" /></label>
            <label className="label label-caps" style={{ gridColumn: "3/-1" }}>Hours<input name="openingHours" defaultValue={g.openingHours} placeholder="Mo-Fr 09:00-17:00" className="admin-input admin-input-sm" /></label>
            <p style={{ fontSize: 11.5, color: "#6b7486", margin: 0, gridColumn: "1/-1" }}>Name, phone and email come from Contact & footer above. Hours use two-letter days and 24-hour times; separate different days with “;”, e.g. <code>Mo-Fr 09:00-17:00; Sa 10:00-14:00</code>.</p>
          </fieldset>
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save Google settings</button>
        </form>
        <div style={{ display: "grid", gap: 8, fontSize: 12, borderTop: "1px solid #eef0f4", paddingTop: 12 }}>
          <span style={{ fontWeight: 700 }}>Links to copy into Google</span>
          <span><span style={{ color: "#6b7486" }}>Sitemap (Search Console → Sitemaps):</span> <code style={{ userSelect: "all" }}>{site}/sitemap.xml</code></span>
          <span><span style={{ color: "#6b7486" }}>Website field in your Business Profile (tracked in Analytics):</span> <code style={{ userSelect: "all", wordBreak: "break-all" }}>{trackedProfileWebsiteUrl(site)}</code></span>
          <span><span style={{ color: "#6b7486" }}>Ask clients for a review:</span> {g.placeId ? <code style={{ userSelect: "all", wordBreak: "break-all" }}>{reviewUrl(g.placeId)}</code> : <em style={{ color: "#8c95a8" }}>add your Place ID to get this link</em>}</span>
          <span style={{ color: "#6b7486" }}>To show the map on a page, open Content → Pages and add a “Google map” block.</span>
        </div>
      </Card>
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
