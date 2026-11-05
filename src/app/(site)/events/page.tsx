import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "@/components/site/SiteFrame";
import { getUpcomingEvents } from "@/lib/data/site";
import { fmtDate } from "@/lib/utils";
import { EVENT_REGIONS, eventLocation, eventPath, isEventRegion, regionLabel } from "@/lib/events";

export const dynamic = "force-dynamic";
type SP = { searchParams: Promise<{ region?: string }> };

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const { region } = await searchParams; const r = isEventRegion(region) ? region : null;
  return { title: r ? `${regionLabel(r)} events` : "Events", description: `Upcoming${r ? ` ${regionLabel(r)}` : ""} workshops, fairs and talks for older adults, families and caregivers.`, alternates: { canonical: r ? `/events?region=${r}` : "/events" } };
}

/** Every upcoming published event, all regions or one. Each card opens the event's own page. */
export default async function EventsIndex({ searchParams }: SP) {
  const { region } = await searchParams; const r = isEventRegion(region) ? region : undefined;
  const events = await getUpcomingEvents(r);
  const tabs: [string, string][] = [["", "All regions"], ...EVENT_REGIONS.map((x) => [x.key, x.label] as [string, string])];
  return (
    <SiteFrame label="Events" active="none">
      <section className="gx" style={{ paddingTop: 72, paddingBottom: 104, maxWidth: 1000 }}>
        <span className="eyebrow">Events</span>
        <h1 className="h1" style={{ fontSize: 52, margin: "14px 0 12px" }}>{r ? `${regionLabel(r)} events` : "Upcoming events"}</h1>
        <p className="lede" style={{ marginBottom: 28 }}>Workshops, fairs, clinics and talks for older adults, families and caregivers.</p>
        <nav aria-label="Filter by region" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {tabs.map(([k, l]) => <Link key={k || "all"} href={k ? `/events?region=${k}` : "/events"} className={`pill${(r || "") === k ? " is-on" : ""}`}>{l}</Link>)}
        </nav>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.length === 0 && <div style={{ padding: "28px 32px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", fontSize: 15, color: "#4b5569" }}>No upcoming events are listed{r ? ` for ${regionLabel(r)}` : ""} right now. Check back soon.</div>}
          {events.map((e) => (
            <Link key={e.id} href={e.slug ? eventPath(e.slug) : "/events"} style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr)", gap: 20, alignItems: "center", padding: "20px 24px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", color: "inherit", textDecoration: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 84, height: 84, borderRadius: 14, background: "#f7f8fa" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{fmtDate(e.startsAt, { month: "short" }, e.tz)}</span>
                <span className="display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>{fmtDate(e.startsAt, { day: "numeric" }, e.tz)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{e.title}</span>
                <span style={{ fontSize: 13, color: "#6b7486" }}>{[e.timeLabel, eventLocation(e), !r ? regionLabel(e.region) : null, e.cost].filter(Boolean).join(" · ")}</span>
              </div>
            </Link>))}
        </div>
      </section>
    </SiteFrame>
  );
}
