import { getEventBySlug } from "@/lib/data/site";
import { buildEventIcs } from "@/lib/server/ics";
import { env } from "@/lib/env";
import { localDay } from "@/lib/cc-events";
import { eventLocation, eventPath } from "@/lib/events";
export const dynamic = "force-dynamic";

/** "Add to calendar" on an event page: an all-day .ics entry on the event's own date. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const e = await getEventBySlug(slug);
  if (!e) return new Response("Event not found", { status: 404 });
  const page = `${env.baseUrl}${eventPath(e.slug!)}`;
  const description = [e.timeLabel ? `Time: ${e.timeLabel}` : "", `Hosted by ${e.host}`, e.description, e.url ? `Register: ${e.url}` : "", `Event page: ${page}`].filter(Boolean).join("\n\n");
  const ics = buildEventIcs({ uid: `event-${e.id}@graceindesign`, day: localDay(e.startsAt, e.tz), summary: e.title, description, location: eventLocation(e), url: page });
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${e.slug}.ics"`, "cache-control": "no-store" } });
}
