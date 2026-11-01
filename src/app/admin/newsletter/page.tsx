import Link from "next/link";
import { requireArea } from "@/lib/auth/session";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import { env } from "@/lib/env";
import { relativeDay, fmtDateTime } from "@/lib/utils";
import { AUDIENCES, AUDIENCE_KEYS, CARIBBEAN_SEGMENTS, STATUS_FILTERS, describeInstaStatus, filterSubscribers, instaLinks, isAudienceKey, needsPush, summarizeSubscribers, type StatusTone, type SubscriberRecord } from "@/lib/newsletter";
import { instaConnection, loadSubscribers, ensureInstaIntegrationRow } from "@/lib/server/insta-newsletter";
import { subscriberAction, addSubscriber, saveNewsletterSettings, connectInstaNewsletter, instaAction } from "@/lib/actions/newsletter";
import { slackConfigured } from "@/lib/server/slack";
import { getSetting } from "@/lib/server/settings";

export const metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";
const TABS = [["subscribers", "Subscribers"], ["insta", "Insta-Newsletter"], ["settings", "Settings"]] as const;
type Tab = (typeof TABS)[number][0];
const TONES: Record<StatusTone, [string, string]> = { ok: ["#dcefe4", "#1f6b3f"], wait: ["#fff4d6", "#7a5a00"], bad: ["#fbe9e2", "#9a3c1e"], muted: ["#f2f4f7", "#6b7486"] };
const help: React.CSSProperties = { fontSize: 12, color: "#6b7486", lineHeight: 1.6 };

function SyncPill({ rec, connected }: { rec: SubscriberRecord; connected: boolean }) {
  const d = describeInstaStatus(rec, connected); const [bg, color] = TONES[d.tone];
  return <span className="status-pill" title={d.detail || undefined} style={{ background: bg, color, cursor: d.detail ? "help" : undefined }}>{d.label}</span>;
}

export default async function NewsletterAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; audience?: string; status?: string; q?: string }> }) {
  const user = await requireArea("newsletter");
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t[0] === sp.tab)?.[0] || "subscribers";
  await ensureInstaIntegrationRow();
  const [records, { conn, settings }, notif] = await Promise.all([loadSubscribers(), instaConnection(), getSetting("notifications")]);
  const connected = Boolean(conn);
  const summary = summarizeSubscribers(records);
  const links = instaLinks(conn?.url || settings.instaUrl);
  const audience = isAudienceKey(sp.audience) ? sp.audience : null; const status = STATUS_FILTERS.some(([k]) => k === sp.status) ? String(sp.status) : "active"; const q = (sp.q || "").trim();
  const shown = filterSubscribers(records, { audience, status, q });
  const waiting = records.filter((r) => needsPush(r)).length;
  const href = (patch: { tab?: Tab; audience?: string | null; status?: string; q?: string }) => {
    const p = new URLSearchParams(); const t = patch.tab ?? tab; p.set("tab", t);
    const a = patch.audience === undefined ? audience : patch.audience; if (a) p.set("audience", a);
    const s = patch.status ?? status; if (s !== "active") p.set("status", s);
    const qq = patch.q ?? q; if (qq) p.set("q", qq);
    return `/admin/newsletter?${p}`;
  };
  const back = href({});
  const exportHref = `/api/admin/export?kind=subscribers${audience ? `&audience=${audience}` : ""}&status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const recent = records.filter((r) => r.instaSyncedAt || r.instaError).sort((a, b) => (b.instaSyncedAt?.getTime() || b.createdAt.getTime()) - (a.instaSyncedAt?.getTime() || a.createdAt.getTime())).slice(0, 12);
  const Hidden = ({ rec }: { rec: SubscriberRecord }) => <><input type="hidden" name="subscriberId" value={rec.id} /><input type="hidden" name="audience" value={rec.audience} /><input type="hidden" name="_back" value={back} /></>;

  return (
    <AdminShell user={user} active="newsletter" title="Newsletter" subtitle="Who signed up on the website, and the hand-off to Insta-Newsletter, where newsletters are written and sent"
      actions={links.home ? <a href={links.home} target="_blank" rel="noreferrer" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Open Insta-Newsletter ↗</a> : <Link href={href({ tab: "insta" })} className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Connect Insta-Newsletter</Link>}>
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="Active subscribers" value={summary.active} delta={`${summary.byAudience["caribbean-connection"]} Caribbean Connection · ${summary.byAudience["healthy-home"]} Healthy Home`} />
        <Stat label="In Insta-Newsletter" value={summary.synced} delta={connected ? (summary.confirming ? `${summary.confirming} awaiting their confirmation` : "the list of record") : "not connected yet"} deltaColor={connected ? "#1f6b3f" : "#9a3c1e"} />
        <Stat label="Waiting or failed" value={summary.waiting + summary.failed} delta={summary.failed ? `${summary.failed} failed · ${summary.waiting} waiting` : connected ? "sent on the next sync" : "connect to send them"} deltaColor={summary.failed ? "#9a3c1e" : "#6b7486"} />
        <Stat label="New sign-ups · 30 days" value={summary.newLast30Days} delta="from the website forms" />
      </div>

      {!connected && (
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", padding: "14px 18px", borderRadius: 14, background: "#fff4d6", color: "#7a5a00", fontSize: 13 }}>
          <strong>Insta-Newsletter is not connected.</strong><span>Sign-ups are being kept on the website. Connect once and every new sign-up, plus everything waiting here, flows straight into your Insta-Newsletter audiences.</span>
          <Link href={href({ tab: "insta" })} className="btn btn-navy btn-xs" style={{ borderRadius: 8, marginLeft: "auto" }}>Connect now</Link>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{TABS.map(([k, l]) => <Link key={k} href={href({ tab: k })} className={`pill${tab === k ? " is-on" : ""}`}>{l}{k === "insta" && !connected ? " · set up" : ""}</Link>)}</div>

      {tab === "subscribers" && (<>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="label-caps" style={{ fontSize: 11, color: "#6b7486" }}>List</span>
          <Link href={href({ audience: null })} className={`pill${!audience ? " is-on" : ""}`}>All</Link>
          {AUDIENCE_KEYS.map((k) => <Link key={k} href={href({ audience: k })} className={`pill${audience === k ? " is-on" : ""}`}>{AUDIENCES[k].name}</Link>)}
          <span className="label-caps" style={{ fontSize: 11, color: "#6b7486", marginLeft: 12 }}>Show</span>
          {STATUS_FILTERS.map(([k, l]) => <Link key={k} href={href({ status: k })} className={`pill${status === k ? " is-on" : ""}`}>{l}</Link>)}
          <form method="get" action="/admin/newsletter" style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <input type="hidden" name="tab" value="subscribers" />{audience && <input type="hidden" name="audience" value={audience} />}<input type="hidden" name="status" value={status} />
            <input name="q" defaultValue={q} placeholder="Search email, segment, location" className="admin-input admin-input-sm" style={{ width: 240 }} />
            <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Search</button>
            {q && <Link href={href({ q: "" })} className="link-btn link-muted" style={{ fontSize: 12 }}>Clear</Link>}
          </form>
        </div>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <Card title={`Website sign-ups · ${shown.length}`} sub="The list of record lives in Insta-Newsletter. This is the website's own log of who signed up and whether they got there." action={<a href={exportHref} className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Export CSV</a>}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) 130px minmax(0, 1.2fr) 86px 190px auto", gap: 10, fontSize: 11, color: "#8c95a8", textTransform: "uppercase", letterSpacing: ".06em", padding: "0 0 6px", borderBottom: "1px solid #e9ecf1" }}><span>Email</span><span>List</span><span>Details</span><span>Signed up</span><span>Insta-Newsletter</span><span /></div>
            <div style={{ maxHeight: 620, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {shown.map((r) => {
                const a = AUDIENCES[r.audience]; const push = needsPush(r);
                const sendLabel = !connected ? null : r.unsubscribedAt ? null : r.instaStatus === "suppressed" ? "Email them a confirmation link" : r.instaStatus === "failed" ? "Try again" : push ? "Send now" : null;
                return (
                  <div key={`${r.audience}-${r.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) 130px minmax(0, 1.2fr) 86px 190px auto", gap: 10, alignItems: "center", fontSize: 12, padding: "7px 0", borderBottom: "1px solid #f2f4f7", opacity: r.unsubscribedAt ? .55 : 1 }}>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.email}>{r.email}</span>
                    <span className="tag" style={{ justifySelf: "start" }}>{a.short}</span>
                    <span style={{ color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={[r.segment, r.location].filter(Boolean).join(" · ")}>{r.audience === "healthy-home" ? "Checklist download" : [r.segment, r.location || r.country].filter(Boolean).join(" · ") || "—"}</span>
                    <span style={{ color: "#8c95a8" }} title={fmtDateTime(r.createdAt)}>{relativeDay(r.createdAt)}</span>
                    <span><SyncPill rec={r} connected={connected} /></span>
                    <span style={{ display: "flex", gap: 10, justifyContent: "flex-end", whiteSpace: "nowrap" }}>
                      {sendLabel && <form action={subscriberAction}><Hidden rec={r} /><input type="hidden" name="op" value="sync" /><button type="submit" className="link-btn">{sendLabel}</button></form>}
                      <form action={subscriberAction}><Hidden rec={r} /><input type="hidden" name="op" value={r.unsubscribedAt ? "resubscribe" : "unsubscribe"} /><button type="submit" className="link-btn link-muted">{r.unsubscribedAt ? "Re-subscribe" : "Unsubscribe"}</button></form>
                      <form action={subscriberAction}><Hidden rec={r} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove ${r.email} from the website's records?\n\nThis only clears the website's log. ${r.unsubscribedAt ? "" : "They stay in Insta-Newsletter unless you unsubscribe them first."}`}>Remove</ConfirmButton></form>
                    </span>
                  </div>);
              })}
              {!shown.length && <span style={{ fontSize: 13, color: "#8c95a8", padding: "18px 0" }}>{records.length ? "Nobody matches these filters." : "No sign-ups yet. They arrive from the Caribbean Connection page and the Healthy Home checklist."}</span>}
            </div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card title="Add someone by hand" sub="Recorded on the website and added to Insta-Newsletter. No welcome email is sent.">
              <form action={addSubscriber} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input name="email" type="email" required placeholder="name@example.com" className="admin-input admin-input-sm" />
                <label className="label label-caps">List<select name="audience" className="admin-input admin-input-sm" defaultValue="caribbean-connection">{AUDIENCE_KEYS.map((k) => <option key={k} value={k}>{AUDIENCES[k].name}</option>)}</select></label>
                <label className="label label-caps">Segment (Caribbean Connection)<select name="segment" className="admin-input admin-input-sm" defaultValue={CARIBBEAN_SEGMENTS[0]}>{CARIBBEAN_SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></label>
                <input name="location" placeholder="City, Country (optional)" className="admin-input admin-input-sm" />
                <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Add subscriber</button>
              </form>
            </Card>
            <Card title="Moving an existing list over" sub="One-time backfill into Insta-Newsletter">
              <div style={{ ...help, display: "flex", flexDirection: "column", gap: 8 }}>
                <span><strong>Fastest:</strong> connect Insta-Newsletter, then press <em>Send everything waiting</em> on the Insta-Newsletter tab. Every active sign-up here is pushed over, a hundred at a time.</span>
                <span><strong>Or by file:</strong> <a href={exportHref} className="link-btn">Export CSV</a> gives a file Insta-Newsletter&apos;s Contacts → Import reads as-is. People who unsubscribed stay unsubscribed; segment and location become custom fields.</span>
              </div>
            </Card>
          </div>
        </div>
      </>)}

      {tab === "insta" && (
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card title="Connection" sub="The website hands every sign-up to Insta-Newsletter the moment it happens and retries anything that did not get through." action={<StatusPill status={connected ? (settings.lastCheckError ? "error" : "connected") : "not_connected"} />}>
              <div style={{ display: "grid", gridTemplateColumns: "150px minmax(0, 1fr)", gap: "8px 14px", fontSize: 13, alignItems: "baseline" }}>
                <span style={help}>Account</span><span>{settings.instaAccountName || <span style={{ color: "#8c95a8" }}>—</span>}</span>
                <span style={help}>API key</span><span>{conn ? <><code>{settings.instaApiKeyPrefix || "inl_…"}…</code> <span style={help}>{conn.source === "secrets" ? "from Replit Secrets (INSTA_NEWSLETTER_API_KEY)" : "pasted here, stored encrypted"}</span></> : <span style={{ color: "#8c95a8" }}>none yet</span>}</span>
                <span style={help}>Plan</span><span>{settings.instaPlan ? `${settings.instaPlan.name} · ${settings.instaPlan.used.toLocaleString()} of ${settings.instaPlan.cap.toLocaleString()} contacts used` : <span style={{ color: "#8c95a8" }}>—</span>}</span>
                <span style={help}>Audiences</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>{AUDIENCE_KEYS.map((k) => <span key={k}>{settings.audienceIds[k] ? <span style={{ color: "#1f6b3f" }}>✓</span> : <span style={{ color: "#9a3c1e" }}>✗</span>} {AUDIENCES[k].name} <span style={help}>← {AUDIENCES[k].signupLabel}</span></span>)}</span>
                <span style={help}>Last checked</span><span>{settings.lastCheckedAt ? fmtDateTime(settings.lastCheckedAt) : <span style={{ color: "#8c95a8" }}>never</span>}</span>
                {settings.lastCheckError && <><span style={help}>Problem</span><span style={{ color: "#9a3c1e" }}>{settings.lastCheckError}</span></>}
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #eef0f4", paddingTop: 12, fontSize: 12 }}>
                <form action={instaAction}><input type="hidden" name="op" value="check" /><button type="submit" className="link-btn" disabled={!connected && !settings.instaUrl}>Check connection</button></form>
                <form action={instaAction}><input type="hidden" name="op" value="sync_all" /><ConfirmButton message={`Send ${waiting} waiting sign-up${waiting === 1 ? "" : "s"} to Insta-Newsletter now?`} className="link-btn" title={connected ? undefined : "Connect first"}>Send everything waiting{waiting ? ` (${waiting})` : ""}</ConfirmButton></form>
                {conn?.source === "admin" && <form action={instaAction} style={{ marginLeft: "auto" }}><input type="hidden" name="op" value="disconnect" /><ConfirmButton message="Disconnect Insta-Newsletter? New sign-ups stay on the website until you connect again. Nothing in Insta-Newsletter is deleted." className="link-btn link-danger">Disconnect</ConfirmButton></form>}
              </div>
            </Card>
            <Card title={connected ? "Change the connection" : "Connect Insta-Newsletter"} sub="About two minutes. The website creates the two audiences for you.">
              <ol style={{ ...help, margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                <li>In Insta-Newsletter open <strong>Settings → Developers</strong>{links.developers && <> (<a href={links.developers} target="_blank" rel="noreferrer" className="link-btn">open ↗</a>)</>}.</li>
                <li>Create a key named <em>Grace In Design website</em> with the scopes <code>subscribers:write</code>, <code>audiences:read</code> and <code>audiences:write</code>.</li>
                <li>Copy the key (it is shown once there) and paste it below.</li>
              </ol>
              {conn?.source === "secrets" ? <span style={help}>The address and key come from Replit Secrets (<code>INSTA_NEWSLETTER_URL</code>, <code>INSTA_NEWSLETTER_API_KEY</code>). Change them there, then press <em>Check connection</em>.</span> : (
                <form action={connectInstaNewsletter} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label className="label label-caps">Insta-Newsletter address<input name="url" defaultValue={settings.instaUrl} placeholder="https://insta-newsletter.com" className="admin-input admin-input-sm" required /></label>
                  <label className="label label-caps">API key{settings.instaApiKeyEnc ? " (leave blank to keep the current one)" : ""}<input name="apiKey" type="password" autoComplete="off" placeholder="inl_…" className="admin-input admin-input-sm" /></label>
                  <span style={help}>Stored encrypted on the website; never shown again. Prefer Replit Secrets? Set <code>INSTA_NEWSLETTER_URL</code> and <code>INSTA_NEWSLETTER_API_KEY</code> instead and this form switches off.</span>
                  <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>{connected ? "Save and test" : "Connect and test"}</button>
                </form>
              )}
            </Card>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card title="How it works" sub="Three steps, two systems">
              <ol style={{ ...help, fontSize: 13, color: "#4b5569", margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>Someone subscribes on the website</strong> (Caribbean Connection page or the Healthy Home checklist). The website records it and sends its own welcome or the checklist.</li>
                <li><strong>The website hands them to Insta-Newsletter</strong> straight away, into the matching audience, with their segment, location and consent details. Anything that fails is retried every 15 minutes.</li>
                <li><strong>You write and send in Insta-Newsletter.</strong> Templates, scheduling, open and click tracking, unsubscribe links and the public archive all live there. The Caribbean Connection page keeps a simple plain-text <em>Compose issue</em> for quick notes to that list.</li>
              </ol>
            </Card>
            <Card title="Do these in Insta-Newsletter" sub="The website does not duplicate them">
              {links.home ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <a href={links.newsletters} target="_blank" rel="noreferrer" className="link-btn">Write and send a newsletter ↗</a>
                  <a href={links.campaigns} target="_blank" rel="noreferrer" className="link-btn">Campaigns and scheduling ↗</a>
                  <a href={links.contacts} target="_blank" rel="noreferrer" className="link-btn">Contacts and audiences ↗</a>
                  <a href={links.developers} target="_blank" rel="noreferrer" className="link-btn">Settings → Developers (API keys) ↗</a>
                </div>
              ) : <span style={help}>Enter Insta-Newsletter&apos;s address on the left and these become links.</span>}
            </Card>
            <Card title="Recent hand-offs" sub="The last sign-ups the website sent over">
              {recent.map((r) => { const d = describeInstaStatus(r, connected); return (
                <div key={`${r.audience}-${r.id}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, fontSize: 12, padding: "5px 0", borderBottom: "1px solid #f2f4f7", alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span>{r.email}</span> <span style={help}>· {AUDIENCES[r.audience].short} · {relativeDay(r.instaSyncedAt || r.createdAt)}</span>{d.detail && d.tone === "bad" ? <><br /><span style={{ color: "#9a3c1e" }}>{d.detail}</span></> : null}</span>
                  <SyncPill rec={r} connected={connected} />
                </div>); })}
              {!recent.length && <span style={help}>Nothing sent yet.</span>}
            </Card>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
          <Card title="Sign-up emails" sub="What the website itself sends when someone subscribes. Newsletters come from Insta-Newsletter.">
            <form action={saveNewsletterSettings} style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span>Send a welcome email from the website after a Caribbean Connection sign-up<br /><span style={help}>From {env.senders.newsletter.formatted}. Switch this off if Insta-Newsletter sends its own welcome, so people do not get two.</span></span><input type="checkbox" name="sendWelcomeEmail" defaultChecked={settings.sendWelcomeEmail} /></label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><span>Ask Insta-Newsletter to confirm by email before adding the person<br /><span style={help}>Double opt-in: they get a confirmation link and join when they click it. Cleaner consent and fewer typos, one more step for them. Off means they are added at once.</span></span><input type="checkbox" name="doubleOptIn" defaultChecked={settings.doubleOptIn} /></label>
              <span style={help}>The Healthy Home checklist email is always sent: it is what the person asked for.</span>
              <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save</button>
            </form>
          </Card>
          <Card title="Good to know">
            <div style={{ ...help, fontSize: 13, color: "#4b5569", display: "flex", flexDirection: "column", gap: 10 }}>
              <span><strong>Slack notice on each sign-up:</strong> {notif.slackOnOtherForms ? "on" : "off"}{slackConfigured() ? "" : " (Slack is not configured)"}. Change it under <Link href="/admin/forms" className="link-btn">Form builder → Notifications</Link>.</span>
              <span><strong>Where people sign up:</strong> the <Link href="/caribbean-connection#newsletter" className="link-btn">Caribbean Connection page</Link> and the <Link href="/healthy-home-resources/wellness" className="link-btn">Healthy Home checklist</Link>. Neither form asks for a name.</span>
              <span><strong>Unsubscribing:</strong> newsletters sent from Insta-Newsletter carry its own unsubscribe link. The website&apos;s own link (<code>{env.baseUrl}/unsubscribe</code>, in the welcome email) takes the person off both website lists and tells Insta-Newsletter.</span>
              <span><strong>Who can see this page:</strong> owners and editors.</span>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
