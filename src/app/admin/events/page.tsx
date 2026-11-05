import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { requireArea } from "@/lib/auth/session";
import { db, ccEvents, ccCountries } from "@/lib/db";
import AdminShell from "@/components/admin/AdminShell";
import { Card, Stat, StatusPill } from "@/components/admin/ui";
import Toast from "@/components/admin/Toast";
import ConfirmButton from "@/components/admin/Confirm";
import { EventRegionFields, CopyEventLink } from "@/components/admin/EventFields";
import { eventAction, addEvent } from "@/lib/actions/catalog";
import { fmtDate, relativeDay } from "@/lib/utils";
import { isUpcomingEvent } from "@/lib/cc-events";
import { EVENT_REGIONS, eventLocation, eventPath, isEventRegion, regionLabel } from "@/lib/events";
import { env } from "@/lib/env";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";
const STATUSES = ["Pending", "Published", "Rejected", "All"] as const;

/**
 * Every event, any region: review public submissions, add your own, edit, and copy each approved event's link.
 * (This used to be the Community events tab under Caribbean Connection; that tab now links here.)
 */
export default async function EventsAdmin({ searchParams }: { searchParams: Promise<{ filter?: string; region?: string }> }) {
  const user = await requireArea("caribbean");
  const sp = await searchParams;
  const filter = (STATUSES as readonly string[]).includes(sp.filter || "") ? sp.filter! : "Pending";
  const region = isEventRegion(sp.region) ? sp.region : "";
  const [all, countries, [pending]] = await Promise.all([
    db.select().from(ccEvents).orderBy(desc(ccEvents.startsAt)),
    db.select().from(ccCountries).orderBy(asc(ccCountries.sort)),
    db.select({ n: sql<number>`count(*)` }).from(ccEvents).where(eq(ccEvents.status, "pending")),
  ]);
  const countryNames = countries.map((c) => c.name);
  const inRegion = region ? all.filter((e) => e.region === region) : all;
  const events = filter === "All" ? inRegion : inRegion.filter((e) => e.status === filter.toLowerCase());
  const qs = (o: { filter?: string; region?: string }) => { const q = new URLSearchParams(Object.entries({ filter, region, ...o }).filter(([, v]) => v) as [string, string][]).toString(); return `/admin/events${q ? `?${q}` : ""}`; };
  const back = qs({});
  const Hidden = ({ id }: { id: number }) => <><input type="hidden" name="eventId" value={id} /><input type="hidden" name="_back" value={back} /></>;
  const upcoming = all.filter((e) => e.status === "published" && isUpcomingEvent(e));

  return (
    <AdminShell user={user} active="events" title="Events" subtitle="Review submissions, add events in the Caribbean or the United States, and share each event's own page">
      <Toast />
      <div className="g3" style={{ gap: 16 }}>
        <Stat label="Awaiting review" value={Number(pending.n)} delta="public submissions" deltaColor={Number(pending.n) ? "#9a3c1e" : "#6b7486"} />
        <Stat label="Upcoming events" value={upcoming.length} delta={EVENT_REGIONS.map((r) => `${upcoming.filter((e) => e.region === r.key).length} ${r.label}`).join(" · ")} />
        <Stat label="Event pages" value={all.filter((e) => e.slug && e.status === "published").length} delta="published, with a shareable link" />
      </div>

      <Card title="Events" sub="Approving gives an event its own page at /events/<name-of-event>. The link never changes, even if you edit the title later. Events leave the public lists by themselves at midnight (their own time zone) once their date has passed; their page stays up so shared links keep working."
        action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {STATUSES.map((f) => <Link key={f} href={qs({ filter: f })} className={`pill${filter === f ? " is-on" : ""}`}>{f}{f === "Pending" && Number(pending.n) ? ` · ${pending.n}` : ""}</Link>)}
          <span style={{ width: 1, background: "#e3e6ec", margin: "0 4px" }} />
          <Link href={qs({ region: "" })} className={`pill${!region ? " is-on" : ""}`}>All regions</Link>
          {EVENT_REGIONS.map((r) => <Link key={r.key} href={qs({ region: r.key })} className={`pill${region === r.key ? " is-on" : ""}`}>{r.label}</Link>)}
        </div>}>
        {events.map((e) => (
          <details key={e.id} style={{ borderBottom: "1px solid #f2f4f7", padding: "8px 0" }}>
            <summary style={{ display: "grid", gridTemplateColumns: "54px minmax(0, 2fr) 160px 120px 100px auto", gap: 12, alignItems: "center", fontSize: 13, cursor: "pointer", listStyle: "none" }}>
              <div style={{ textAlign: "center", borderRadius: 8, background: "#e6f3fc", padding: "4px 0" }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{fmtDate(e.startsAt, { month: "short" }, e.tz)}</div><div style={{ fontSize: 18, fontWeight: 700 }}>{fmtDate(e.startsAt, { day: "numeric" }, e.tz)}</div></div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{e.title}</span>
                <span style={{ fontSize: 12, color: "#6b7486" }}>{regionLabel(e.region)} · {eventLocation(e)} · {e.format.replace("_", " ")}{e.timeLabel ? ` · ${e.timeLabel}` : ""}</span>
                {e.slug && e.status === "published" && <span style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}><a href={eventPath(e.slug)} target="_blank" rel="noreferrer" className="link-btn" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{eventPath(e.slug)} ↗</a><CopyEventLink url={`${env.baseUrl}${eventPath(e.slug)}`} /></span>}
              </div>
              <span style={{ fontSize: 12 }}>{e.host}</span>
              <span style={{ fontSize: 12, color: "#6b7486" }}>{e.submittedByEmail || "GID"}<br /><span style={{ fontSize: 11 }}>{relativeDay(e.createdAt)}</span></span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}><StatusPill status={e.status} />{!isUpcomingEvent(e) && <span title="Past events are not shown in the public lists" style={{ fontSize: 10, color: "#8c95a8", whiteSpace: "nowrap" }}>Past · not listed</span>}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {e.status === "pending" && <form action={eventAction}><Hidden id={e.id} /><input type="hidden" name="op" value="approve" /><button type="submit" className="link-btn">Approve</button></form>}
                {e.status !== "rejected" && <form action={eventAction} style={{ display: "flex", gap: 4 }}><Hidden id={e.id} /><input type="hidden" name="op" value="reject" /><input name="note" placeholder="Reason" className="admin-input admin-input-sm" style={{ width: 110, height: 28 }} /><button type="submit" className="link-btn link-muted">Reject</button></form>}
                {e.status === "published" && <form action={eventAction}><Hidden id={e.id} /><input type="hidden" name="op" value="unlist" /><button type="submit" className="link-btn link-muted">Unlist</button></form>}
                {e.status === "rejected" && <form action={eventAction}><Hidden id={e.id} /><input type="hidden" name="op" value="restore" /><button type="submit" className="link-btn">Restore</button></form>}
                <form action={eventAction}><Hidden id={e.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete “${e.title}”? Its page and link stop working.`}>Delete</ConfirmButton></form>
              </div>
            </summary>
            <form action={eventAction} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "12px 0 4px" }}>
              <Hidden id={e.id} /><input type="hidden" name="op" value="update" />
              <label className="label label-caps" style={{ gridColumn: "1/3" }}>Title<input name="title" defaultValue={e.title} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Date<input name="date" type="date" defaultValue={e.startsAt.toISOString().slice(0, 10)} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Time<input name="timeLabel" defaultValue={e.timeLabel || ""} placeholder="10:00 am – 12:00 pm" className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Venue / where<input name="whereLabel" defaultValue={e.whereLabel} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Format<select name="format" defaultValue={e.format} className="admin-input admin-input-sm"><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select></label>
              <label className="label label-caps">Host<input name="host" defaultValue={e.host} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Registration link<input name="url" defaultValue={e.url || ""} placeholder="https://" className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Cost<input name="cost" defaultValue={e.cost} className="admin-input admin-input-sm" /></label>
              <EventRegionFields region={e.region} state={e.state} city={e.city} country={e.country} countries={countryNames} />
              <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Description<textarea name="description" rows={3} defaultValue={e.description} className="admin-input" /></label>
              <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>Save edits</button>
            </form>
          </details>))}
        {!events.length && <span style={{ fontSize: 13, color: "#8c95a8" }}>Nothing {filter === "All" ? "" : `${filter.toLowerCase()} `}{region ? `in ${regionLabel(region)} ` : ""}right now.</span>}
      </Card>

      <Card title="Add an event" sub="Events you add are approved straight away and get their link immediately.">
        <form action={addEvent} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input type="hidden" name="_back" value={back} />
          <label className="label label-caps" style={{ gridColumn: "1/3" }}>Title<input name="title" required className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Date<input name="date" type="date" required className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Time<input name="timeLabel" placeholder="10:00 am – 12:00 pm" className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Venue / where<input name="whereLabel" placeholder="Venue, or Online" className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Format<select name="format" defaultValue="in_person" className="admin-input admin-input-sm"><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select></label>
          <label className="label label-caps">Host<input name="host" defaultValue="Grace In Design" className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Registration link<input name="url" placeholder="https://" className="admin-input admin-input-sm" /></label>
          <label className="label label-caps">Cost<input name="cost" placeholder="Free" className="admin-input admin-input-sm" /></label>
          <EventRegionFields region={region || undefined} countries={countryNames} />
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Description<textarea name="description" rows={3} className="admin-input" /></label>
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8, justifySelf: "start" }}>+ Add event</button>
        </form>
      </Card>

      <Card title="Show events on a page" sub="Events appear on the Caribbean Connection page, on /events, and on any page you add an events section to.">
        <p style={{ fontSize: 13, lineHeight: 1.7, color: "#4b5569", margin: 0 }}>
          Go to <Link href="/admin/content" className="link-btn">Content → Pages</Link>, open the page, and choose <strong>Add block</strong> → <em>United States events section</em>, <em>Caribbean events section</em> or <em>Events (choose region, state or city)</em>.
          In the block you can narrow it to a state and city (for example Georgia → Atlanta), set how many events show, and turn the <em>Submit an event</em> form on or off. Submissions from that form arrive here, already set to that block's region, state and city.
        </p>
      </Card>
    </AdminShell>
  );
}
