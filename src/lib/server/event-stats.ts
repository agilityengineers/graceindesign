// server-only
import { and, eq, sql } from "drizzle-orm";
import { db, ccEvents } from "@/lib/db";
import { isBot } from "@/lib/event-stats";

/** Which counter each kind of count adds to (property names on `ccEvents`). */
const FIELD = { view: "viewCount", share: "shareClicks", register: "registerClicks", calendar: "calendarAdds" } as const;
export type EventStat = keyof typeof FIELD;

/**
 * Add one to an event's counter, in a single atomic UPDATE (two visitors at once both count). Only published events count,
 * and requests from crawlers and link-preview bots are ignored. Never throws: a counting hiccup must not break the page,
 * the calendar download or the forward to the registration site.
 */
export async function countEvent(id: number, stat: EventStat, userAgent: string | null): Promise<void> {
  if (isBot(userAgent)) return;
  const field = FIELD[stat];
  try { await db.update(ccEvents).set({ [field]: sql`${ccEvents[field]} + 1` } as Partial<typeof ccEvents.$inferInsert>).where(and(eq(ccEvents.id, id), eq(ccEvents.status, "published"))); }
  catch (e) { console.error("[event-stats] count failed:", (e as Error).message); }
}
