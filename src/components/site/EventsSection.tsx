import { getUpcomingEvents } from "@/lib/data/site";
import { fmtDate, slugify } from "@/lib/utils";
import { cleanEventFilter, eventFilterLabel, eventLocation, eventPath, eventsHref, type EventFilter } from "@/lib/events";
import { SubmitEventForm } from "./CaribbeanForms";

type Content = { eyebrow?: string; title?: string; body?: string; limit?: number; showForm?: boolean; formEyebrow?: string; formBody?: string };

/**
 * An events list (and, if the block has it on, the "Submit an event" form) for any page. The block chooses the region and,
 * for the United States, optionally a state and city. The Caribbean page's original `cc_events` block is this section fixed
 * to the Caribbean, with the anchor `#events` it always had.
 */
export default async function EventsSection({ c, filter, anchor }: { c: Content; filter: EventFilter; anchor?: string }) {
  const f = cleanEventFilter(filter);
  const limit = Math.min(50, Math.max(1, Number(c.limit) || 8));
  const events = await getUpcomingEvents(f.region, f.state, f.city, limit);
  const id = anchor || ["events", f.region, f.state.toLowerCase(), slugify(f.city)].filter(Boolean).join("-");
  const showForm = c.showForm !== false;
  const place = eventFilterLabel(f);
  return (
    <section id={id} className="gx g2 g2-stack-md" style={{ paddingBottom: 104, gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 64, alignItems: "start" }}>
      <div className="sticky-md-off" style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        {c.title && <h2 className="h2" style={{ fontSize: 44 }}>{c.title}</h2>}
        {c.body && <p style={{ fontSize: 15, lineHeight: 1.7, color: "#4b5569" }}>{c.body}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {showForm && <a href={`#${id}-submit`} className="btn btn-navy">Submit an event</a>}
          <a href={eventsHref(f)} className={showForm ? "btn btn-ghost" : "btn btn-navy"}>See all events</a>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.length === 0 && <div style={{ padding: "28px 32px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 17, fontWeight: 600 }}>No upcoming events{place ? ` in ${place}` : ""} are listed yet.</span><span style={{ fontSize: 14, lineHeight: 1.65, color: "#6b7486" }}>Know of a fair, workshop, clinic or talk for older adults, families or caregivers?{showForm ? " Submit it below and we'll review it for listing." : " Check back soon."}</span></div>}
        {events.map((e, k) => {
          const virtual = e.format === "virtual"; const d = e.startsAt; const bg = k === 0 ? "#1a2238" : virtual ? "#e6f3fc" : "#f7f8fa"; const color = k === 0 ? "#fff" : "#1a2238";
          const href = e.slug ? eventPath(e.slug) : e.url || `#${id}`; const external = !e.slug && !!e.url;
          return (
            <div key={e.id} className="reveal event-row" style={{ display: "grid", gridTemplateColumns: "84px 1fr auto", gap: 20, alignItems: "center", padding: "20px 24px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 84, height: 84, borderRadius: 14, background: bg, color }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{fmtDate(d, { month: "short" }, e.tz)}</span><span className="display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>{fmtDate(d, { day: "numeric" }, e.tz)}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><a href={href} target={external ? "_blank" : undefined} rel="noreferrer" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: "inherit", textDecoration: "none" }}>{e.title}</a>{virtual && <span style={{ padding: "3px 8px", borderRadius: 999, background: "#e6f3fc", fontSize: 10, fontWeight: 700, letterSpacing: ".06em" }}>VIRTUAL</span>}</div>
                <span style={{ fontSize: 13, lineHeight: 1.55, color: "#6b7486", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.description}</span>
                <span style={{ fontSize: 12, color: "#8c95a8" }}>{[e.timeLabel, eventLocation(e), e.host].filter(Boolean).join(" · ")}</span>
              </div>
              <a href={href} target={external ? "_blank" : undefined} rel="noreferrer" className="btn btn-ghost btn-sm" style={{ height: 40 }}>Details</a>
            </div>);
        })}
        {showForm && <div id={`${id}-submit`} style={{ marginTop: 12, padding: 28, borderRadius: 16, background: "#f7f8fa", border: "1px solid #e9ecf1", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{c.formEyebrow && <span className="eyebrow eyebrow-sm">{c.formEyebrow}</span>}{c.formBody && <span style={{ fontSize: 14, lineHeight: 1.6, color: "#4b5569" }}>{c.formBody}</span>}</div>
          <SubmitEventForm region={f.region} state={f.state} city={f.city} />
        </div>}
      </div>
    </section>
  );
}
