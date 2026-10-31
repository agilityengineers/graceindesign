import Link from "next/link";
import { and, asc, desc, eq, gte, sql, inArray } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, socialAccounts, socialPosts, socialFeedItems, leads } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import { NETWORKS, NETWORK_LABELS } from "@/lib/server/social";
import { etDate } from "@/lib/server/consult";
import { env } from "@/lib/env";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import ImagePicker from "@/components/admin/ImagePicker";
import { createSocialPost, socialPostAction, disconnectSocial, syncFeedsNow } from "@/lib/actions/social";
import { saveSocialSettings } from "@/lib/actions/settings";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Social media" };
export const dynamic = "force-dynamic";
const TZ = "America/New_York";
const ymdOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10); };
const weekdayOf = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NET_COLORS: Record<string, string> = { facebook: "#1877f2", instagram: "#d6249f", linkedin: "#0a66c2", pinterest: "#e60023", youtube: "#ff0000" };

export default async function SocialAdmin({ searchParams }: { searchParams: Promise<{ week?: string; edit?: string }> }) {
  const user = await requireArea("social");
  const sp = await searchParams;
  const today = ymdOf(new Date());
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.week || "") ? sp.week! : today;
  const monday = addDays(anchor, -((weekdayOf(anchor) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekStart = etDate(monday, "00:00"); const weekEnd = etDate(addDays(monday, 7), "00:00");
  const d7 = new Date(Date.now() - 7 * 864e5);
  const [accounts, weekPosts, drafts, recent, settings, [attributed], feedCount] = await Promise.all([
    db.select().from(socialAccounts),
    db.select().from(socialPosts).where(and(sql`coalesce(${socialPosts.scheduledAt}, ${socialPosts.publishedAt}, ${socialPosts.createdAt}) >= ${weekStart}`, sql`coalesce(${socialPosts.scheduledAt}, ${socialPosts.publishedAt}, ${socialPosts.createdAt}) < ${weekEnd}`)).orderBy(asc(socialPosts.scheduledAt)),
    db.select().from(socialPosts).where(eq(socialPosts.status, "draft")).orderBy(desc(socialPosts.updatedAt)).limit(20),
    db.select().from(socialPosts).where(inArray(socialPosts.status, ["published", "failed"])).orderBy(desc(socialPosts.updatedAt)).limit(30),
    getSetting("social"),
    db.select({ n: sql<number>`count(*)` }).from(leads).where(and(gte(leads.createdAt, d7), sql`lower(coalesce(${leads.utm}->>'utm_source','')) in ('facebook','instagram','linkedin','pinterest','youtube','social')`)),
    db.select({ n: sql<number>`count(*)` }).from(socialFeedItems),
  ]);
  const acctBy = new Map(accounts.map((a) => [a.network, a]));
  const totals = recent.filter((p) => p.status === "published" && p.publishedAt && p.publishedAt >= d7).reduce((a, p) => { for (const m of Object.values(p.metrics || {})) { a.imp += m.impressions || 0; a.eng += m.engagements || 0; a.clicks += m.clicks || 0; } return a; }, { imp: 0, eng: 0, clicks: 0 });
  const postsOn = (ymd: string) => weekPosts.filter((p) => ymdOf(p.scheduledAt || p.publishedAt || p.createdAt) === ymd);
  const editing = Number(sp.edit) ? weekPosts.concat(drafts, recent).find((p) => p.id === Number(sp.edit)) : null;
  const back = `/admin/social${sp.week ? `?week=${sp.week}` : ""}`;
  const PostLine = ({ p }: { p: typeof weekPosts[number] }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, borderRadius: 8, background: "#fff", border: "1px solid #eef0f4", fontSize: 11 }}>
      <span style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>{p.networks.map((n) => <span key={n} style={{ width: 8, height: 8, borderRadius: "50%", background: NET_COLORS[n] || "#8c95a8" }} title={n} />)}<span style={{ color: "#6b7486" }}>{p.scheduledAt ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(p.scheduledAt) : p.publishedAt ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(p.publishedAt) : ""}</span></span>
      <span style={{ lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{p.body}</span>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><StatusPill status={p.status} /><Link href={`${back}${back.includes("?") ? "&" : "?"}edit=${p.id}`} className="link-btn">Edit</Link></span>
    </div>
  );
  return (
    <AdminShell user={user} active="social" title="Social media" subtitle="Connect networks, plan the content calendar and watch what drives leads" actions={<form action={syncFeedsNow}><button type="submit" className="btn btn-ghost btn-sm" style={{ height: 40, borderRadius: 10 }}>Sync feeds now</button></form>}>
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="Impressions · 7 days" value={totals.imp ? totals.imp.toLocaleString() : "—"} delta={accounts.some((a) => a.status === "connected") ? "from connected networks" : "connect a network to start tracking"} />
        <Stat label="Engagements · 7 days" value={totals.eng ? totals.eng.toLocaleString() : "—"} delta={`${recent.filter((p) => p.status === "published" && p.publishedAt && p.publishedAt >= d7).length} posts published`} />
        <Stat label="Link clicks → site" value={totals.clicks ? totals.clicks.toLocaleString() : "—"} delta="tracked per post" />
        <Stat label="Leads attributed to social" value={Number(attributed.n)} delta="utm_source in the last 7 days" deltaColor="#1f6b3f" />
      </div>
      <Card title="Accounts" sub="OAuth connections used for publishing and the on-site feed. Tokens are stored encrypted.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {NETWORKS.map((n) => { const a = acctBy.get(n); const on = a?.status === "connected"; const cfg = n === "facebook" || n === "instagram" ? !!env.social.meta.id : !!env.social[n as "linkedin" | "pinterest" | "youtube"]?.id; return (
            <div key={n} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 12, border: "1px solid #eef0f4", background: "#fff" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: NET_COLORS[n] }} />{NETWORK_LABELS[n]}</span>
              <span style={{ fontSize: 12, color: "#6b7486" }}>{on ? `${a?.displayName || "Connected"}${a?.followers != null ? ` · ${a.followers.toLocaleString()} followers` : ""}` : cfg ? "Not connected" : "App credentials missing"}</span>
              <StatusPill status={on ? "connected" : "not_connected"} />
              {on ? <form action={disconnectSocial}><input type="hidden" name="network" value={n} /><ConfirmButton message={`Disconnect ${NETWORK_LABELS[n]}? Scheduled posts to it will fail until reconnected.`}>Disconnect</ConfirmButton></form>
                : <a href={`/api/social/start/${n}`} className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start", opacity: cfg ? 1 : .5 }} title={cfg ? "" : "Add the app id/secret under Replit Secrets first"}>Connect</a>}
            </div>); })}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
        <Card title="Content calendar" sub={`Week of ${days[0]} · Eastern time`} action={<div style={{ display: "flex", gap: 6 }}><Link href={`/admin/social?week=${addDays(monday, -7)}`} className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>‹</Link><Link href="/admin/social" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>This week</Link><Link href={`/admin/social?week=${addDays(monday, 7)}`} className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>›</Link></div>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, overflowX: "auto" }}>
            {days.map((d) => <div key={d} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 160, padding: 6, borderRadius: 10, background: d === today ? "#e6f3fc" : "#f7f9fc" }}><span style={{ fontSize: 11, fontWeight: 700, color: "#1a2238" }}>{DAYS[weekdayOf(d)]} {Number(d.slice(8))}</span>{postsOn(d).map((p) => <PostLine key={p.id} p={p} />)}</div>)}
          </div>
          {drafts.length > 0 && <div style={{ borderTop: "1px solid #eef0f4", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}><span className="label-caps">Drafts & auto-share queue</span>{drafts.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.body}</span><span style={{ display: "flex", gap: 10, flex: "none" }}><Link href={`${back}${back.includes("?") ? "&" : "?"}edit=${p.id}`} className="link-btn">Edit</Link><form action={socialPostAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Delete this draft?">Delete</ConfirmButton></form></span></div>)}</div>}
          {recent.length > 0 && <div style={{ borderTop: "1px solid #eef0f4", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}><span className="label-caps">Recently published / failed</span>{recent.slice(0, 8).map((p) => <div key={p.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px auto", gap: 10, fontSize: 12, alignItems: "center" }}><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.body}</span><StatusPill status={p.status} /><span style={{ display: "flex", gap: 10 }}>{p.status === "failed" && <form action={socialPostAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="publish" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn">Retry</button></form>}<span style={{ color: "#8c95a8" }}>{Object.entries(p.results || {}).map(([n, r]) => `${n}: ${r.status}${r.error ? ` (${r.error.slice(0, 40)})` : ""}`).join(" · ")}</span><form action={socialPostAction}><input type="hidden" name="postId" value={p.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Delete this post record?">Delete</ConfirmButton></form></span></div>)}</div>}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {editing ? (
            <Card title="Edit post" sub={`${editing.status}${editing.scheduledAt ? ` · ${fmtDateTime(editing.scheduledAt)} ET` : ""}`} action={<Link href={back} className="link-btn link-muted">Close</Link>}>
              <form action={socialPostAction} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input type="hidden" name="postId" value={editing.id} /><input type="hidden" name="op" value="update" /><input type="hidden" name="_back" value={back} />
                <textarea name="body" rows={5} defaultValue={editing.body} className="admin-input" />
                <input name="linkUrl" defaultValue={editing.linkUrl || ""} placeholder="Link (optional)" className="admin-input admin-input-sm" />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{NETWORKS.map((n) => <label key={n} style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="networks" value={n} defaultChecked={editing.networks.includes(n)} />{NETWORK_LABELS[n]}</label>)}</div>
                <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save</button>
              </form>
              <form action={socialPostAction} style={{ display: "flex", gap: 6, alignItems: "end", flexWrap: "wrap" }}>
                <input type="hidden" name="postId" value={editing.id} /><input type="hidden" name="op" value="reschedule" /><input type="hidden" name="_back" value={back} />
                <label className="label label-caps">Date<input name="date" type="date" defaultValue={editing.scheduledAt ? ymdOf(editing.scheduledAt) : today} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Time<input name="time" type="time" defaultValue="10:00" className="admin-input admin-input-sm" /></label>
                <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8, height: 34 }}>Reschedule</button>
              </form>
              <div style={{ display: "flex", gap: 14 }}>
                <form action={socialPostAction}><input type="hidden" name="postId" value={editing.id} /><input type="hidden" name="op" value="publish" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn">Publish now</button></form>
                {editing.status === "scheduled" && <form action={socialPostAction}><input type="hidden" name="postId" value={editing.id} /><input type="hidden" name="op" value="unschedule" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">Back to drafts</button></form>}
                <form action={socialPostAction}><input type="hidden" name="postId" value={editing.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message="Delete this post?">Delete</ConfirmButton></form>
              </div>
              {editing.imageUrl && <img src={editing.imageUrl} alt="" style={{ width: "100%", borderRadius: 10 }} />}
            </Card>
          ) : (
            <Card title="Compose">
              <form action={createSocialPost} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea name="body" rows={5} placeholder="What's new at Grace In Design?" className="admin-input" required />
                <input name="linkUrl" placeholder="Link (optional)" className="admin-input admin-input-sm" />
                <ImagePicker label="Image (optional)" name="imageUrl" fileName="image_file" showUrl width={96} height={64} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{NETWORKS.map((n) => <label key={n} style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="networks" value={n} defaultChecked={["facebook", "linkedin"].includes(n)} />{NETWORK_LABELS[n]}</label>)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label className="label label-caps">Date<input name="date" type="date" defaultValue={addDays(today, 1)} className="admin-input admin-input-sm" /></label><label className="label label-caps">Time (ET)<input name="time" type="time" defaultValue="10:00" className="admin-input admin-input-sm" /></label></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="submit" name="intent" value="schedule" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Schedule</button><button type="submit" name="intent" value="now" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Publish now</button><button type="submit" name="intent" value="draft" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Save draft</button></div>
              </form>
            </Card>
          )}
          <Card title="On-site social feed" sub="Shown on homepage footer band">
            <form action={saveSocialSettings} style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <input type="hidden" name="_back" value="/admin/social" />
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>Show Instagram feed<input type="checkbox" name="showInstagramFeed" defaultChecked={settings.showInstagramFeed} /></label>
              <label className="label label-caps">Posts to show<select name="feedCount" defaultValue={settings.feedCount} className="admin-input admin-input-sm"><option value={6}>6</option><option value={9}>9</option></select></label>
              {(["facebook", "linkedin", "instagram", "pinterest"] as const).map((n) => <input key={n} type="hidden" name={`as_${n}`} value={settings.autoShare[n] ? "on" : ""} />)}
              <span style={{ fontSize: 12, color: "#6b7486" }}>{Number(feedCount[0].n)} feed items cached · refreshed by the <code>social</code> cron job.</span>
              <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, alignSelf: "flex-start" }}>Save</button>
            </form>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
