// server-only
import { rateLimit } from "@/lib/server/rate-limit";
import { countEvent, type EventStat } from "./event-stats";

/** How many of each count one visitor (IP) can add to one event per hour. Beyond that the request still works; it just isn't counted. */
const PER_HOUR: Record<EventStat, number> = { view: 6, share: 20, register: 10, calendar: 10 };

/** Count a request against an event, unless it's a bot or this visitor has already been counted a lot this hour. */
export async function countEventRequest(req: Request, e: { id: number; slug: string | null }, stat: EventStat) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  try { if (!(await rateLimit(`ev:${stat}:${e.slug || e.id}:${ip}`, PER_HOUR[stat], 3600)).ok) return; } catch { /* the counter must never break the request */ }
  await countEvent(e.id, stat, req.headers.get("user-agent"));
}
