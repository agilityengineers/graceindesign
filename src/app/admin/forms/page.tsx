import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, formFields, paths } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import { PAGE_LABELS } from "@/lib/seed-data/form";
import AdminShell from "@/components/admin/AdminShell";
import { Card } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import Sortable from "@/components/admin/Sortable";
import { addFormField, updateFormField, formFieldAction, reorderFormFields, saveFormSettings, savePath, deletePath } from "@/lib/actions/forms";
import { env } from "@/lib/env";
import { smsRoute } from "@/lib/server/outbox";
import { slackConfigured } from "@/lib/server/slack";
import { cftMasterConfigured } from "@/lib/server/cft-master";

export const metadata = { title: "Form builder" };
export const dynamic = "force-dynamic";
const TYPE_LABELS: Record<string, string> = { text: "Short text", email: "Email", phone: "Phone", select: "Dropdown", multiselect: "Multiple choice", yesno: "Yes / No", textarea: "Long text", upload: "File upload", date: "Date", address: "Address", consent: "Consent checkbox" };
const STEP_LABELS: Record<string, string> = { path: "About you", project: "Your project", contact: "Contact", schedule: "Schedule", review: "Review" };

function FieldRow({ f, back }: { f: typeof formFields.$inferSelect; back: string }) {
  const hasOptions = ["select", "multiselect"].includes(f.type);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #eef0f4", background: f.visible ? "#fff" : "#f7f9fc", opacity: f.visible ? 1 : 0.75 }}>
      <form action={updateFormField} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 2fr) 130px 120px auto", gap: 8, alignItems: "center" }}>
        <input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="_back" value={back} />
        <input name="label" defaultValue={f.label} className="admin-input admin-input-sm" aria-label="Question label" />
        <select name="type" defaultValue={f.type} className="admin-input admin-input-sm" aria-label="Type">{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="step" defaultValue={f.step} className="admin-input admin-input-sm" aria-label="Step">{Object.entries(STEP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}><label style={{ display: "flex", alignItems: "center", gap: 4 }}><input type="checkbox" name="required" defaultChecked={f.required} />Required</label><button type="submit" className="link-btn">Save</button></div>
        {hasOptions && <textarea name="options" rows={1} defaultValue={f.options.join(", ")} placeholder="Options, comma-separated" className="admin-input" style={{ gridColumn: "1/-1", minHeight: 34, padding: "6px 10px", fontSize: 12 }} aria-label="Options" />}
        {!hasOptions && f.type !== "consent" && f.type !== "upload" && <input name="placeholder" defaultValue={f.placeholder || ""} placeholder="Placeholder (optional)" className="admin-input admin-input-sm" style={{ gridColumn: "1/-1", fontSize: 12 }} aria-label="Placeholder" />}
      </form>
      <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11, color: "#8c95a8" }}>
        <span>key: <code>{f.key}</code></span>
        <form action={formFieldAction} style={{ marginLeft: "auto" }}><input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="op" value="visible" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">{f.visible ? "Hide" : "Show"}</button></form>
        <form action={formFieldAction}><input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message={`Delete the question “${f.label}”? Existing leads keep their answers.`}>Delete</ConfirmButton></form>
      </div>
    </div>
  );
}

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const user = await requireArea("forms");
  const sp = await searchParams;
  const [pathRows, fields, settings] = await Promise.all([db.select().from(paths).orderBy(asc(paths.sort)), db.select().from(formFields).orderBy(asc(formFields.sort), asc(formFields.id)), getSettings(["notifications", "consult_form"])]);
  const audience = pathRows.find((p) => p.id === sp.audience) || pathRows[0];
  const base = fields.filter((f) => f.scope === "base");
  const extras = audience ? fields.filter((f) => f.scope === "path" && f.pathId === audience.id) : [];
  const back = `/admin/forms?audience=${encodeURIComponent(audience?.id || "")}`;
  const livePage = audience ? Object.keys(PAGE_LABELS).find((k) => audience.pageKeys.includes(k)) : null;
  return (
    <AdminShell user={user} active="forms" title="Form builder" subtitle="Shared questions on every service page, plus audience-specific extras">
      <Toast />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Shared base questions" sub="Appear on every service page form. Drag to reorder.">
            <Sortable ids={base.map((f) => f.id)} onReorder={reorderFormFields} handleTop>{base.map((f) => <FieldRow key={f.id} f={f} back={back} />)}</Sortable>
          </Card>
          <Card title="Audience-specific extras" sub="Shown only on the selected service page. Residential and commercial visitors see different questions.">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{pathRows.map((p) => <Link key={p.id} href={`/admin/forms?audience=${p.id}`} className={`pill${audience?.id === p.id ? " is-on" : ""}`} style={{ opacity: p.isActive ? 1 : 0.5 }}>{p.short}</Link>)}</div>
            {audience && (<>
              <Sortable ids={extras.map((f) => f.id)} onReorder={reorderFormFields} handleTop>{extras.map((f) => <FieldRow key={f.id} f={f} back={back} />)}</Sortable>
              {!extras.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>No extra questions for {audience.short} yet.</span>}
              <details style={{ borderTop: "1px solid #eef0f4", paddingTop: 12 }}>
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#3f9ad9" }}>Edit the “{audience.label}” audience</summary>
                <form action={savePath} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <input type="hidden" name="pathId" value={audience.id} /><input type="hidden" name="_back" value={back} />
                  <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Label<input name="label" defaultValue={audience.label} className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps">Short name<input name="short" defaultValue={audience.short} className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps">Consultation type<input name="consultType" defaultValue={audience.consultType} className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps">Page keys (comma-separated)<input name="pageKeys" defaultValue={audience.pageKeys.join(", ")} className="admin-input admin-input-sm" /></label>
                  <label className="label label-caps">Colour<input name="color" type="color" defaultValue={audience.color} className="admin-input admin-input-sm" style={{ padding: 2 }} /></label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><input type="checkbox" name="isActive" defaultChecked={audience.isActive} />Active (offered in the “About you” step)</label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save audience</button></div>
                </form>
                <form action={deletePath} style={{ marginTop: 8, textAlign: "right" }}><input type="hidden" name="pathId" value={audience.id} /><ConfirmButton message={`Remove the “${audience.label}” audience and its extra questions?`}>Remove audience</ConfirmButton></form>
              </details>
            </>)}
            <details style={{ borderTop: "1px solid #eef0f4", paddingTop: 12 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#3f9ad9" }}>+ Add a new audience</summary>
              <form action={savePath} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <input type="hidden" name="_back" value={back} />
                <label className="label label-caps">Id (slug)<input name="id" placeholder="e.g. nonprofit" className="admin-input admin-input-sm" required /></label>
                <label className="label label-caps">Short name<input name="short" className="admin-input admin-input-sm" /></label>
                <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Label<input name="label" placeholder="Nonprofit — Community space" className="admin-input admin-input-sm" required /></label>
                <label className="label label-caps">Consultation type<input name="consultType" defaultValue="15-min discovery call" className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Page keys<input name="pageKeys" className="admin-input admin-input-sm" placeholder="commercial" /></label>
                <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>Add audience</button>
              </form>
            </details>
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="New question">
            <form action={addFormField} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="hidden" name="_back" value={back} />
              <label className="label label-caps">Label<input name="label" className="admin-input admin-input-sm" required placeholder="What's your timeline?" /></label>
              <label className="label label-caps">Type<select name="type" className="admin-input admin-input-sm" defaultValue="text">{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="label label-caps">Options (for dropdown / multiple choice)<textarea name="options" rows={2} className="admin-input" placeholder="One per line, or comma-separated" style={{ fontSize: 12 }} /></label>
              <label className="label label-caps">Step<select name="step" className="admin-input admin-input-sm" defaultValue="project">{Object.entries(STEP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><input type="checkbox" name="required" />Required</label>
              <span className="label-caps">Pick</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="radio" name="scope" value="base" defaultChecked />Shared base question (every form)</label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="radio" name="scope" value="path" />Only for {audience?.short || "this audience"}</label>
                <input type="hidden" name="pathId" value={audience?.id || ""} />
              </div>
              <button type="submit" className="btn btn-navy btn-xs" style={{ alignSelf: "flex-start", borderRadius: 8 }}>Add question</button>
            </form>
          </Card>
          {audience && (
            <Card title={`Live preview · ${audience.short}`}>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#4b5569" }}><strong>{base.filter((f) => f.visible).length + extras.filter((f) => f.visible).length} questions</strong> on this form. Every submission is tagged <span className="tag">source: {audience.short}</span> and lands in Leads.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#6b7486" }}>{Object.entries(STEP_LABELS).map(([k, v]) => { const n = [...base, ...extras].filter((f) => f.visible && f.step === k).length; return n ? <span key={k}>{v}: {n}</span> : null; })}</div>
              <Link href={livePage ? (livePage === "hhr" ? "/healthy-home-resources" : livePage === "virtual-assessment" ? "/services/aging-in-place/virtual" : livePage === "design-refresh" || livePage === "model-home" ? `/services/residential/${livePage}` : `/services/${livePage}`) : "/contact"} className="link-btn" style={{ fontSize: 12 }}>Open live page →</Link>
            </Card>
          )}
          <Card title="Notifications & form mode" sub="Who hears about a new request, and how">
            <form action={saveFormSettings} style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <span className="label-caps">Email</span>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Email the team on a new consultation request<input type="checkbox" name="emailAdminOnNewLead" defaultChecked={settings.notifications.emailAdminOnNewLead} /></label>
              <label className="label label-caps">Sales inbox (consultation requests)<input name="salesEmail" type="email" defaultValue={settings.notifications.salesEmail} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Support inbox (directory, events, everything else)<input name="adminEmail" type="email" defaultValue={settings.notifications.adminEmail} className="admin-input admin-input-sm" /></label>
              <span style={{ fontSize: 11, color: "#8c95a8", lineHeight: 1.5 }}>Mail goes out from the verified senders: {env.senders.noreply.email} (no reply needed), {env.senders.support.email} (general), {env.senders.consultation.email} (sales), {env.senders.newsletter.email} (newsletter).</span>
              <span className="label-caps" style={{ marginTop: 6 }}>Text message</span>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Text Grace on a new consultation request<input type="checkbox" name="smsAdminOnNewLead" defaultChecked={settings.notifications.smsAdminOnNewLead} /></label>
              <label className="label label-caps">Grace's mobile<input name="adminPhone" defaultValue={settings.notifications.adminPhone || env.adminNotifyPhone} placeholder="+1 770 …" className="admin-input admin-input-sm" /></label>
              <span style={{ fontSize: 11, color: "#8c95a8", lineHeight: 1.5 }}>{(() => { const r = smsRoute(); return r === "cft" ? `Sent through Call Flow Tracker from ${env.cft.smsFrom}; the text carries a link that signs her into Call Flow Tracker.` : r === "twilio" ? "Sent through this app's own Twilio number (set CFT_SMS_FROM to send through Call Flow Tracker instead)." : "Texts are logged to the outbox until Call Flow Tracker (CFT_URL, CFT_MASTER_DASHBOARD_SECRET, CFT_SMS_FROM) or Twilio keys are configured."; })()}</span>
              <span className="label-caps" style={{ marginTop: 6 }}>Slack {slackConfigured() ? "" : "(SLACK_WEBHOOK_URL not set — posts are logged only)"}</span>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Post new consultation requests<input type="checkbox" name="slackOnNewLead" defaultChecked={settings.notifications.slackOnNewLead} /></label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Post directory / event submissions and newsletter sign-ups<input type="checkbox" name="slackOnOtherForms" defaultChecked={settings.notifications.slackOnOtherForms} /></label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Post calls and leads reported by Call Flow Tracker<input type="checkbox" name="slackOnCftEvents" defaultChecked={settings.notifications.slackOnCftEvents} /></label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Include the auto sign-in link to Call Flow Tracker (private channel only)<input type="checkbox" name="cftLinkInSlack" defaultChecked={settings.notifications.cftLinkInSlack} /></label>
              <span className="label-caps" style={{ marginTop: 6 }}>Call Flow Tracker</span>
              <label className="label label-caps">Team member the texts and sign-in links are for (their CFT login email)<input name="cftUserEmail" type="email" defaultValue={settings.notifications.cftUserEmail} className="admin-input admin-input-sm" /></label>
              <span style={{ fontSize: 11, color: "#8c95a8", lineHeight: 1.5 }}>{cftMasterConfigured() ? `Auto sign-in is live (${env.cft.url}); links expire after 20 minutes and can be used once.` : env.cft.url ? "CFT_MASTER_DASHBOARD_SECRET is not set, so links open Call Flow Tracker's login page instead of signing in automatically." : "CFT_URL is not set — links open this admin instead."}</span>
              <label className="label label-caps" style={{ marginTop: 6 }}>Public form layout<select name="mode" defaultValue={settings.consult_form.mode} className="admin-input admin-input-sm"><option value="wizard">Multi-step wizard</option><option value="single">Single page</option></select></label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Let visitors switch layouts<input type="checkbox" name="allowVisitorToggle" defaultChecked={settings.consult_form.allowVisitorToggle} /></label>
              <button type="submit" className="btn btn-navy btn-xs" style={{ alignSelf: "flex-start", borderRadius: 8 }}>Save</button>
            </form>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
