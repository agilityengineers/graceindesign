import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import ShareEvent from "@/components/site/ShareEvent";
import { getEventBySlug } from "@/lib/data/site";
import { env } from "@/lib/env";
import { fmtDate } from "@/lib/utils";
import { isUpcomingEvent, localDay } from "@/lib/cc-events";
import { eventLocation, eventPath, regionLabel, usState } from "@/lib/events";
import type { CcEvent } from "@/lib/db";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ slug: string }> };

const FORMAT = { in_person: "In person", virtual: "Online", hybrid: "In person & online" } as Record<string, string>;
const longDate = (e: CcEvent) => fmtDate(e.startsAt, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, e.tz);
const summary = (e: CcEvent) => e.description.replace(/\s+/g, " ").trim().slice(0, 200);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params; const e = await getEventBySlug(slug); if (!e) return {};
  const title = `${e.title} · ${fmtDate(e.startsAt, { month: "short", day: "numeric", year: "numeric" }, e.tz)}`;
  const description = `${longDate(e)}${e.timeLabel ? `, ${e.timeLabel}` : ""} · ${eventLocation(e)}. ${summary(e)}`.slice(0, 300);
  return { title, description, alternates: { canonical: eventPath(e.slug!) }, openGraph: { type: "website", title, description, url: eventPath(e.slug!) }, twitter: { card: "summary", title, description } };
}

/** schema.org Event, so search engines can show the event (date, place, registration) in their results. */
function jsonLd(e: CcEvent, pageUrl: string) {
  const place = { "@type": "Place", name: e.whereLabel, address: e.region === "us"
    ? { "@type": "PostalAddress", addressLocality: e.city || undefined, addressRegion: usState(e.state)?.[0], addressCountry: "US" }
    : { "@type": "PostalAddress", addressCountry: e.country || undefined } };
  const online = { "@type": "VirtualLocation", url: e.url || pageUrl };
  const free = /^free$/i.test(e.cost.trim());
  return {
    "@context": "https://schema.org", "@type": "Event", name: e.title, description: e.description, url: pageUrl,
    startDate: localDay(e.startsAt, e.tz), eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${e.format === "virtual" ? "Online" : e.format === "hybrid" ? "Mixed" : "Offline"}EventAttendanceMode`,
    location: e.format === "virtual" ? online : e.format === "hybrid" ? [place, online] : place,
    organizer: { "@type": "Organization", name: e.host },
    ...(e.url ? { offers: { "@type": "Offer", url: e.url, availability: "https://schema.org/InStock", ...(free ? { price: 0, priceCurrency: "USD" } : {}) } } : {}),
  };
}

export default async function EventPage({ params }: Params) {
  const { slug } = await params; const e = await getEventBySlug(slug); if (!e) notFound();
  const pageUrl = `${env.baseUrl}${eventPath(e.slug!)}`;
  const upcoming = isUpcomingEvent(e);
  const caribbean = e.region === "caribbean";
  const back = caribbean ? { href: "/caribbean-connection#events", label: "Caribbean Connection events" } : { href: `/events?region=${e.region}`, label: `${regionLabel(e.region)} events` };
  const facts: [string, string][] = [
    ["When", `${longDate(e)}${e.timeLabel ? ` · ${e.timeLabel}` : ""}`],
    ["Where", eventLocation(e)],
    ["Format", FORMAT[e.format] || e.format],
    ["Hosted by", e.host],
    ["Cost", e.cost],
  ];
  return (
    <SiteFrame label={caribbean ? "Caribbean Connection" : "Events"} active={caribbean ? "caribbean" : "none"} sourceKey={caribbean ? "caribbean" : "general"}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(e, pageUrl)).replace(/</g, "\\u003c") }} />
      <article className="gx" style={{ paddingTop: 72, paddingBottom: 104, maxWidth: 900 }}>
        <Link href={back.href} className="eyebrow">← {back.label}</Link>
        {!upcoming && <div role="status" style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: "#f7f8fa", border: "1px solid #e9ecf1", fontSize: 14, color: "#4b5569" }}>This event has already taken place. <Link href="/events" style={{ color: "#3f9ad9", fontWeight: 600 }}>See upcoming events →</Link></div>}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", margin: "24px 0 28px", flexWrap: "wrap" }}>
          <div aria-hidden style={{ flex: "none", width: 96, height: 96, borderRadius: 16, background: "#1a2238", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>{fmtDate(e.startsAt, { month: "short" }, e.tz)}</span>
            <span className="display" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmtDate(e.startsAt, { day: "numeric" }, e.tz)}</span>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <span className="eyebrow eyebrow-sm">{regionLabel(e.region)} · {FORMAT[e.format] || e.format}</span>
            <h1 className="h1" style={{ fontSize: 48, margin: "10px 0 0" }}>{e.title}</h1>
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "10px 24px", margin: "0 0 32px", padding: "22px 24px", borderRadius: 16, border: "1px solid #e9ecf1", background: "#fff", fontSize: 15 }}>
          {facts.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt style={{ fontWeight: 600, color: "#6b7486" }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}
        </dl>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
          {upcoming && e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn btn-navy" style={{ fontWeight: 700 }}>Register / Details ↗</a>}
          {upcoming && <a href={`${eventPath(e.slug!)}/calendar.ics`} className="btn btn-ghost">Add to calendar</a>}
        </div>
        <div className="prose" style={{ fontSize: 17, lineHeight: 1.75, color: "#4b5569", whiteSpace: "pre-line", marginBottom: 40 }}>{e.description}</div>
        <div style={{ borderTop: "1px solid #e9ecf1", paddingTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="eyebrow eyebrow-sm">Share this event</span>
          <ShareEvent url={pageUrl} title={e.title} />
        </div>
      </article>
    </SiteFrame>
  );
}
