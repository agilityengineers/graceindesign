import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, isNull, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, ccResources, ccEvents, ccCountries, ccSubscribers, rssSources, posts } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import { resourceAction, addResource, eventAction, addEvent, countryAction, addRssSource, rssSourceAction } from "@/lib/actions/catalog";
import { fmtDate, relativeDay } from "@/lib/utils";
import { isUpcomingEvent } from "@/lib/cc-events";

export const metadata = { title: "Caribbean Connection" };
export const dynamic = "force-dynamic";
const TABS = [["resources", "Resource directory"], ["events", "Community events"], ["sources", "Regional news sources"], ["countries", "Countries"]] as const;
const CATS = ["Healthcare", "Home modification", "Caregiving", "Government & benefits", "Community", "Legal & finance", "Housing", "Transport"];

export default async function CaribbeanAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const user = await requireArea("caribbean");
  const sp = await searchParams;
  // Newsletter subscribers moved to their own section (Admin → Newsletter); old links still land somewhere useful.
  if (sp.tab === "subscribers") redirect("/admin/newsletter?audience=caribbean-connection");
  const tab = (TABS.find((t) => t[0] === sp.tab)?.[0] || "resources") as (typeof TABS)[number][0]; const filter = sp.filter || "Pending";
  const [resources, events, countries, sources, [resPending], [evPending], [ccSubs]] = await Promise.all([
    db.select().from(ccResources).orderBy(desc(ccResources.createdAt)),
    db.select().from(ccEvents).orderBy(desc(ccEvents.startsAt)),
    db.select().from(ccCountries).orderBy(asc(ccCountries.sort)),
    db.select().from(rssSources).where(eq(rssSources.scope, "caribbean")).orderBy(asc(rssSources.id)),
    db.select({ n: sql<number>`count(*)` }).from(ccResources).where(eq(ccResources.status, "pending")),
    db.select({ n: sql<number>`count(*)` }).from(ccEvents).where(eq(ccEvents.status, "pending")),
    db.select({ n: sql<number>`count(*)` }).from(ccSubscribers).where(isNull(ccSubscribers.unsubscribedAt)),
  ]);
  const countryNames = countries.map((c) => c.name);
  const back = `/admin/caribbean?tab=${tab}&filter=${filter}`;
  const byStatus = <T extends { status: string }>(rows: T[]) => filter === "All" ? rows : rows.filter((r) => r.status === filter.toLowerCase());
  const Filters = () => <div style={{ display: "flex", gap: 8 }}>{["Pending", "Published", "Rejected", "All"].map((f) => <Link key={f} href={`/admin/caribbean?tab=${tab}&filter=${f}`} className={`pill${filter === f ? " is-on" : ""}`}>{f}</Link>)}</div>;
  const Hidden = ({ id, name }: { id: number; name: string }) => <><input type="hidden" name={name} value={id} /><input type="hidden" name="_back" value={back} /></>;

  return (
    <AdminShell user={user} active="caribbean" title="Caribbean Connection" subtitle="Moderate submissions and curate regional sources. Newsletter sign-ups live under Newsletter.">
      <Toast />
      <div className="g4" style={{ gap: 16 }}>
        <Stat label="Awaiting review" value={Number(resPending.n) + Number(evPending.n)} delta={`${resPending.n} resources · ${evPending.n} events`} deltaColor={Number(resPending.n) + Number(evPending.n) ? "#9a3c1e" : "#6b7486"} />
        <Stat label="Published resources" value={resources.filter((r) => r.status === "published").length} delta={`${countries.filter((c) => c.status === "live").map((c) => c.name).join(", ") || "no live countries"}`} />
        <Stat label="Upcoming events" value={events.filter((e) => e.status === "published" && isUpcomingEvent(e)).length} delta="listed publicly" />
        <Stat label="Newsletter sign-ups" value={Number(ccSubs.n)} delta="managed under Newsletter" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{TABS.map(([k, l]) => <Link key={k} href={`/admin/caribbean?tab=${k}`} className={`pill${tab === k ? " is-on" : ""}`}>{l}{k === "resources" && Number(resPending.n) ? ` · ${resPending.n}` : k === "events" && Number(evPending.n) ? ` · ${evPending.n}` : ""}</Link>)}<Link href="/admin/newsletter?audience=caribbean-connection" className="pill" style={{ marginLeft: "auto" }}>Newsletter sign-ups →</Link></div>

      {tab === "resources" && (<>
        <Card title="Resource directory" sub="Submissions from the public land here as Pending. Approve to publish, or reject with a note." action={<Filters />}>
          {byStatus(resources).map((r) => (
            <details key={r.id} style={{ borderBottom: "1px solid #f2f4f7", padding: "8px 0" }}>
              <summary style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) 130px 150px 150px 100px auto", gap: 12, alignItems: "center", fontSize: 13, cursor: "pointer", listStyle: "none" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600 }}>{r.name}</span><span style={{ fontSize: 12, color: "#6b7486", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description}</span></div>
                <span style={{ fontSize: 12 }}>{r.category}</span>
                <span style={{ fontSize: 12 }}>{r.country}{r.area ? ` · ${r.area}` : ""}</span>
                <span style={{ fontSize: 12, color: "#6b7486" }}>{r.submittedByName || r.submittedByEmail || "—"}<br /><span style={{ fontSize: 11 }}>{relativeDay(r.createdAt)} · {r.kind}</span></span>
                <StatusPill status={r.status} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {r.status === "pending" && <form action={resourceAction}><Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="approve" /><button type="submit" className="link-btn">Approve</button></form>}
                  {r.status !== "rejected" && <form action={resourceAction} style={{ display: "flex", gap: 4 }}><Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="reject" /><input name="note" placeholder="Reason (emailed)" className="admin-input admin-input-sm" style={{ width: 130, height: 28 }} /><button type="submit" className="link-btn link-muted">Reject</button></form>}
                  {r.status === "published" && <form action={resourceAction}><Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="unpublish" /><button type="submit" className="link-btn link-muted">Unpublish</button></form>}
                  {r.status === "rejected" && <form action={resourceAction}><Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="restore" /><button type="submit" className="link-btn">Restore</button></form>}
                  <form action={resourceAction}><Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${r.name}”?`}>Delete</ConfirmButton></form>
                </div>
              </summary>
              <form action={resourceAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 0 4px" }}>
                <Hidden id={r.id} name="resourceId" /><input type="hidden" name="op" value="update" />
                <label className="label label-caps">Name<input name="name" defaultValue={r.name} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Category<input name="category" list="ccats" defaultValue={r.category} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Country<input name="country" list="ccountries" defaultValue={r.country} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Area / parish<input name="area" defaultValue={r.area || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Type<input name="type" defaultValue={r.type || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Website<input name="url" defaultValue={r.url || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Description<textarea name="description" rows={2} defaultValue={r.description} className="admin-input" /></label>
                <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#8c95a8" }}><span>{r.submittedByEmail ? `Submitted by ${r.submittedByEmail}` : ""}{r.reviewNote ? ` · note: ${r.reviewNote}` : ""}</span><button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save edits</button></div>
              </form>
            </details>))}
          {!byStatus(resources).length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing {filter.toLowerCase()} right now.</span>}
          <span style={{ fontSize: 12, color: "#6b7486" }}>Approving sends the submitter a “you're listed” email and publishes immediately. Rejecting emails the optional reason. Every listing has a <strong>country</strong> tag so new countries can be turned on later.</span>
          <datalist id="ccats">{CATS.map((c) => <option key={c} value={c} />)}</datalist><datalist id="ccountries">{[...countryNames, "Regional", "Diaspora"].map((c) => <option key={c} value={c} />)}</datalist>
        </Card>
        <Card title="Add a resource" sub="Curated listings publish immediately">
          <form action={addResource} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input name="name" placeholder="Name" className="admin-input admin-input-sm" required /><input name="category" list="ccats" placeholder="Category" className="admin-input admin-input-sm" /><input name="country" list="ccountries" placeholder="Country" defaultValue="Jamaica" className="admin-input admin-input-sm" />
            <input name="area" placeholder="Area / parish" className="admin-input admin-input-sm" /><input name="type" placeholder="Type (clinic, NGO…)" className="admin-input admin-input-sm" /><input name="url" placeholder="https://" className="admin-input admin-input-sm" />
            <textarea name="description" rows={2} placeholder="Description" className="admin-input" style={{ gridColumn: "1/-1" }} />
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>+ Add resource</button>
          </form>
        </Card>
      </>)}

      {tab === "events" && (<>
        <Card title="Community events" sub="Public submissions and GID events. Approve to list; an event leaves the public page by itself at midnight (its own time zone) once its date has passed." action={<Filters />}>
          {byStatus(events).map((e) => (
            <details key={e.id} style={{ borderBottom: "1px solid #f2f4f7", padding: "8px 0" }}>
              <summary style={{ display: "grid", gridTemplateColumns: "54px minmax(0, 2fr) 160px 120px 100px auto", gap: 12, alignItems: "center", fontSize: 13, cursor: "pointer", listStyle: "none" }}>
                <div style={{ textAlign: "center", borderRadius: 8, background: "#e6f3fc", padding: "4px 0" }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{fmtDate(e.startsAt, { month: "short" }, e.tz)}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtDate(e.startsAt, { day: "numeric" }, e.tz)}</div></div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}><span style={{ fontWeight: 600 }}>{e.title}</span><span style={{ fontSize: 12, color: "#6b7486" }}>{e.whereLabel} · {e.format.replace("_", " ")}{e.timeLabel ? ` · ${e.timeLabel}` : ""}</span></div>
                <span style={{ fontSize: 12 }}>{e.host}</span>
                <span style={{ fontSize: 12, color: "#6b7486" }}>{e.submittedByEmail || "GID"}<br /><span style={{ fontSize: 11 }}>{relativeDay(e.createdAt)}</span></span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}><StatusPill status={e.status} />{!isUpcomingEvent(e) && <span title="Past events are not shown on the public page" style={{ fontSize: 10, color: "#8c95a8", whiteSpace: "nowrap" }}>Past · not shown</span>}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {e.status === "pending" && <form action={eventAction}><Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="approve" /><button type="submit" className="link-btn">Approve</button></form>}
                  {e.status !== "rejected" && <form action={eventAction} style={{ display: "flex", gap: 4 }}><Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="reject" /><input name="note" placeholder="Reason" className="admin-input admin-input-sm" style={{ width: 110, height: 28 }} /><button type="submit" className="link-btn link-muted">Reject</button></form>}
                  {e.status === "published" && <form action={eventAction}><Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="unlist" /><button type="submit" className="link-btn link-muted">Unlist</button></form>}
                  {e.status === "rejected" && <form action={eventAction}><Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="restore" /><button type="submit" className="link-btn">Restore</button></form>}
                  <form action={eventAction}><Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${e.title}”?`}>Delete</ConfirmButton></form>
                </div>
              </summary>
              <form action={eventAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 0 4px" }}>
                <Hidden id={e.id} name="eventId" /><input type="hidden" name="op" value="update" />
                <label className="label label-caps" style={{ gridColumn: "1/3" }}>Title<input name="title" defaultValue={e.title} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Date<input name="date" type="date" defaultValue={e.startsAt.toISOString().slice(0, 10)} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Time label<input name="timeLabel" defaultValue={e.timeLabel || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Where<input name="whereLabel" defaultValue={e.whereLabel} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Format<select name="format" defaultValue={e.format} className="admin-input admin-input-sm"><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select></label>
                <label className="label label-caps">Host<input name="host" defaultValue={e.host} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Link<input name="url" defaultValue={e.url || ""} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Cost<input name="cost" defaultValue={e.cost} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps">Country<input name="country" list="ccountries" defaultValue={e.country} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps" style={{ gridColumn: "2/-1" }}>Description<textarea name="description" rows={2} defaultValue={e.description} className="admin-input" /></label>
                <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>Save edits</button>
              </form>
            </details>))}
          {!byStatus(events).length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing {filter.toLowerCase()} right now.</span>}
          <datalist id="ccountries">{[...countryNames, "Regional", "Diaspora"].map((c) => <option key={c} value={c} />)}</datalist>
        </Card>
        <Card title="Add an event">
          <form action={addEvent} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
            <input name="title" placeholder="Title" className="admin-input admin-input-sm" required /><input name="date" type="date" className="admin-input admin-input-sm" required /><input name="timeLabel" placeholder="10:00 am – 12:00 pm" className="admin-input admin-input-sm" />
            <input name="whereLabel" placeholder="Where" className="admin-input admin-input-sm" /><select name="format" className="admin-input admin-input-sm" defaultValue="virtual"><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select><input name="host" placeholder="Host" defaultValue="Grace In Design" className="admin-input admin-input-sm" />
            <input name="url" placeholder="Registration link" className="admin-input admin-input-sm" /><input name="cost" placeholder="Free" className="admin-input admin-input-sm" /><input name="country" list="ccountries" placeholder="Country" defaultValue="Jamaica" className="admin-input admin-input-sm" />
            <textarea name="description" rows={2} placeholder="Description" className="admin-input" style={{ gridColumn: "1/-1" }} />
            <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>+ Add event</button>
          </form>
        </Card>
      </>)}

      {tab === "sources" && (
        <Card title="Regional news sources" sub="RSS feeds curated for the Caribbean Blog column; tag each with a country">
          {sources.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: "1px solid #f2f4f7", opacity: s.isActive ? 1 : .55 }}>
              <form action={rssSourceAction} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr) 150px auto", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="update" /><input type="hidden" name="_back" value={back} />
                <input name="name" defaultValue={s.name} className="admin-input admin-input-sm" /><input name="url" defaultValue={s.url} className="admin-input admin-input-sm" /><input name="country" list="ccountries" defaultValue={s.country || ""} placeholder="Country" className="admin-input admin-input-sm" /><button type="submit" className="link-btn">Save</button>
              </form>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: s.lastError ? "#9a3c1e" : "#8c95a8" }}><span>{s.lastError ? `Error: ${s.lastError}` : s.lastSyncedAt ? `Synced ${relativeDay(s.lastSyncedAt)} · ${s.itemCount} items` : "Not synced yet"}</span><span style={{ display: "flex", gap: 12 }}><form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="sync" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn">Sync now</button></form><form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="toggle" /><input type="hidden" name="_back" value={back} /><button type="submit" className="link-btn link-muted">{s.isActive ? "Pause" : "Resume"}</button></form><form action={rssSourceAction}><input type="hidden" name="sourceId" value={s.id} /><input type="hidden" name="op" value="delete" /><input type="hidden" name="_back" value={back} /><ConfirmButton message={`Remove ${s.name}?`}>Remove</ConfirmButton></form></span></div>
            </div>))}
          <form action={addRssSource} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr) 150px auto", gap: 8, alignItems: "center", paddingTop: 8 }}>
            <input type="hidden" name="scope" value="caribbean" />
            <input name="name" placeholder="Source name" className="admin-input admin-input-sm" /><input name="url" placeholder="https://…/feed" className="admin-input admin-input-sm" required /><input name="country" list="ccountries" placeholder="Jamaica / Regional" className="admin-input admin-input-sm" /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>Add feed</button>
          </form>
          <datalist id="ccountries">{[...countryNames, "Regional", "Trinidad & Tobago", "Barbados"].map((c) => <option key={c} value={c} />)}</datalist>
          <span style={{ fontSize: 12, color: "#6b7486" }}>{(await db.select({ n: sql<number>`count(*)` }).from(posts).where(eq(posts.scope, "caribbean")))[0].n} Caribbean items imported so far. Manage them under Content → News & Insights (filter: Caribbean).</span>
        </Card>
      )}

      {tab === "countries" && (
        <Card title="Countries" sub="Turn a country on when its sources and partners are ready">
          {countries.map((c) => { const nRes = resources.filter((r) => r.country === c.name && r.status === "published").length; const nEv = events.filter((e) => e.country === c.name && e.status === "published").length; const nSrc = sources.filter((s) => s.country === c.name).length; return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) 140px auto", gap: 12, alignItems: "center", fontSize: 13, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: "#6b7486" }}>{nRes} resources · {nEv} events · {nSrc} news sources</span>
              <form action={countryAction} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="hidden" name="countryId" value={c.id} /><input type="hidden" name="op" value="status" /><select name="status" defaultValue={c.status} className="admin-input admin-input-sm"><option value="live">Live</option><option value="next">Next up</option><option value="planned">Planned</option></select><button type="submit" className="link-btn">Save</button></form>
              <form action={countryAction}><input type="hidden" name="countryId" value={c.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Remove ${c.name}?`}>Remove</ConfirmButton></form>
            </div>); })}
          <form action={countryAction} style={{ display: "flex", gap: 8, paddingTop: 8 }}><input type="hidden" name="op" value="add" /><input name="name" placeholder="Country name" className="admin-input admin-input-sm" style={{ width: 220 }} required /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>+ Add country</button></form>
        </Card>
      )}

    </AdminShell>
  );
}
