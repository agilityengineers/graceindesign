import { test } from "node:test";
import assert from "node:assert/strict";
import { isUpcomingEvent, upcomingEvents, localDay, UPCOMING_EVENTS_LOOKBACK_MS, DEFAULT_EVENT_TZ } from "../src/lib/cc-events";

// Jamaica is UTC-5 all year (no daylight saving), so "noon in Kingston" is always 17:00Z.
// Admin-entered and submitted events are stored as noon on the chosen date (see addEvent / submitEvent).
const kingston = (ymd: string, hm = "12:00") => new Date(`${ymd}T${hm}:00-05:00`);
const ev = (startsAt: Date, tz: string | null = "America/Jamaica") => ({ startsAt, tz });

test("yesterday's event is gone the next morning, even though it started less than 24 hours ago", () => {
  // This is the case the old 24-hour grace window got wrong: a noon event on the 30th was still listed at 9 am on the 31st.
  const now = kingston("2026-10-31", "09:00");
  assert.equal(isUpcomingEvent(ev(kingston("2026-10-30")), now), false);
  assert.equal(isUpcomingEvent(ev(kingston("2026-10-29")), now), false);
});

test("today's event stays listed all day, including after its start time", () => {
  const today = ev(kingston("2026-10-31"));
  assert.equal(isUpcomingEvent(today, kingston("2026-10-31", "00:00")), true);
  assert.equal(isUpcomingEvent(today, kingston("2026-10-31", "08:00")), true);
  assert.equal(isUpcomingEvent(today, kingston("2026-10-31", "18:30")), true);
  assert.equal(isUpcomingEvent(today, kingston("2026-10-31", "23:59")), true);
});

test("an event drops off at midnight in its own time zone", () => {
  const e = ev(kingston("2026-10-31"));
  assert.equal(isUpcomingEvent(e, new Date("2026-11-01T04:59:59Z")), true); // 23:59:59 in Kingston
  assert.equal(isUpcomingEvent(e, new Date("2026-11-01T05:00:00Z")), false); // 00:00:00 in Kingston
});

test("future events are upcoming", () => {
  const now = kingston("2026-10-31", "09:00");
  assert.equal(isUpcomingEvent(ev(kingston("2026-11-01")), now), true);
  assert.equal(isUpcomingEvent(ev(kingston("2026-12-25")), now), true);
  assert.equal(isUpcomingEvent(ev(kingston("2027-03-01")), now), true);
});

test("the calendar day is judged in the event's time zone, not the server's", () => {
  // The same instant: 22:00 on Oct 30 in Kingston is already 03:00 on Oct 31 in London (GMT after the Oct 25 clock change).
  const now = new Date("2026-10-31T03:00:00Z");
  const starts = new Date("2026-10-30T15:00:00Z"); // 10:00 Kingston / 15:00 London, both on Oct 30
  assert.equal(isUpcomingEvent({ startsAt: starts, tz: "America/Jamaica" }, now), true);
  assert.equal(isUpcomingEvent({ startsAt: starts, tz: "Europe/London" }, now), false);
  assert.equal(localDay(now, "America/Jamaica"), "2026-10-30");
  assert.equal(localDay(now, "Europe/London"), "2026-10-31");
});

test("a missing time zone means Jamaica, matching the database default", () => {
  assert.equal(DEFAULT_EVENT_TZ, "America/Jamaica");
  const now = new Date("2026-11-01T04:30:00Z"); // 23:30 Oct 31 in Kingston, already Nov 1 in UTC
  const starts = kingston("2026-10-31");
  assert.equal(isUpcomingEvent({ startsAt: starts, tz: null }, now), true);
  assert.equal(isUpcomingEvent({ startsAt: starts }, now), true);
  assert.equal(isUpcomingEvent({ startsAt: starts, tz: "" }, now), true);
});

test("an unknown time zone falls back to UTC instead of throwing", () => {
  const e = { startsAt: new Date("2026-10-31T12:00:00Z"), tz: "Mars/Olympus_Mons" };
  assert.equal(isUpcomingEvent(e, new Date("2026-10-31T23:00:00Z")), true);
  assert.equal(isUpcomingEvent(e, new Date("2026-11-01T00:00:00Z")), false);
});

test("an unreadable date is never upcoming", () => {
  assert.equal(isUpcomingEvent({ startsAt: "not a date" }), false);
  assert.equal(isUpcomingEvent({ startsAt: new Date(NaN) }), false);
});

test("ISO strings work as well as Date objects", () => {
  const now = kingston("2026-10-31", "09:00");
  assert.equal(isUpcomingEvent({ startsAt: "2026-10-30T17:00:00.000Z" }, now), false);
  assert.equal(isUpcomingEvent({ startsAt: "2026-10-31T17:00:00.000Z" }, now), true);
});

test("the database look-back window never cuts off an event this rule would still show", () => {
  // Widest possible case: an event at 00:00 local is still "today" at 23:59:59 local, and on a
  // fall-back day (New York, Nov 1 2026) that day is 25 hours long.
  const starts = new Date("2026-11-01T04:00:00Z"); // 00:00 EDT, Nov 1
  const now = new Date("2026-11-02T04:59:59Z"); // 23:59:59 EST, Nov 1
  assert.equal(isUpcomingEvent({ startsAt: starts, tz: "America/New_York" }, now), true);
  assert.ok(now.getTime() - starts.getTime() > 24 * 3600_000, "the sample day really is longer than 24 hours");
  assert.ok(now.getTime() - starts.getTime() < UPCOMING_EVENTS_LOOKBACK_MS, "the look-back window still includes it");
});

test("the public list drops past events, keeps the order and caps the count", () => {
  const now = kingston("2026-10-31", "09:00");
  const rows = [
    { id: 1, ...ev(kingston("2026-10-29")) },
    { id: 2, ...ev(kingston("2026-10-30")) },
    { id: 3, ...ev(kingston("2026-10-31")) },
    { id: 4, ...ev(kingston("2026-11-02")) },
    { id: 5, ...ev(kingston("2026-11-10")) },
    { id: 6, ...ev(kingston("2026-11-20")) },
  ];
  assert.deepEqual(upcomingEvents(rows, now).map((e) => e.id), [3, 4, 5, 6]);
  assert.deepEqual(upcomingEvents(rows, now, 2).map((e) => e.id), [3, 4]);
  assert.deepEqual(upcomingEvents([], now), []);
});
