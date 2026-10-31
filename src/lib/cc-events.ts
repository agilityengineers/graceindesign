/**
 * Which Caribbean Connection events still count as "upcoming" on the public site.
 *
 * The rule: an event stays on the Community Events board through the end of its own calendar
 * day, in its own time zone, and is gone at midnight local time. Think of the notice board at a
 * community centre: today's flyer stays up all day (the workshop may still be running), and
 * yesterday's comes down before anyone arrives in the morning.
 *
 * These are pure functions with no database access, so the public page, the admin and the test
 * suite (`npm run test:cc-events`) all share one definition of "past".
 */

/** Matches the `cc_events.tz` column default. */
export const DEFAULT_EVENT_TZ = "America/Jamaica";

/**
 * How far back the public query looks before `isUpcomingEvent` makes the final call. An event is
 * still "today" in its own zone for at most 25 hours after it starts (an event at 00:00 local on a
 * fall-back day), so two days is a comfortable margin. The database only narrows the rows; this
 * module decides.
 */
export const UPCOMING_EVENTS_LOOKBACK_MS = 2 * 86_400_000;

/** Calendar date (YYYY-MM-DD) of an instant in an IANA zone. An unknown zone falls back to UTC rather than throwing. */
export function localDay(d: Date, tz?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || DEFAULT_EVENT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** True while the event's date, in the event's own time zone, is today or later. */
export function isUpcomingEvent(e: { startsAt: Date | string; tz?: string | null }, now: Date = new Date()): boolean {
  const starts = typeof e.startsAt === "string" ? new Date(e.startsAt) : e.startsAt;
  if (!(starts instanceof Date) || isNaN(starts.getTime())) return false;
  return localDay(starts, e.tz) >= localDay(now, e.tz);
}

/** The events from `rows` that are still upcoming, in the order given, capped at `limit`. */
export function upcomingEvents<T extends { startsAt: Date | string; tz?: string | null }>(rows: readonly T[], now: Date = new Date(), limit = Infinity): T[] {
  return rows.filter((e) => isUpcomingEvent(e, now)).slice(0, limit);
}
