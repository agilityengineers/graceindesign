import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSlug, eventTimeZone, eventLocation, eventPath, isEventRegion, regionLabel, usState, US_STATES, cleanEventFilter, eventFilterLabel, eventsHref, eventsSection } from "../src/lib/events";
import { isUpcomingEvent } from "../src/lib/cc-events";

test("the link is made from the title", () => {
  assert.equal(eventSlug("Fall-Prevention Workshop for Seniors", "2026-11-14", new Set()), "fall-prevention-workshop-for-seniors");
  assert.equal(eventSlug("  Caregivers' Café & Q/A!  ", "2026-11-14", new Set()), "caregivers-cafe-q-a");
  assert.equal(eventPath("caregivers-cafe-q-a"), "/events/caregivers-cafe-q-a");
});

test("a title already in use gets the date, then a counter", () => {
  const taken = new Set(["health-fair"]);
  assert.equal(eventSlug("Health Fair", "2026-11-14", taken), "health-fair-2026-11-14");
  taken.add("health-fair-2026-11-14");
  assert.equal(eventSlug("Health Fair", "2026-11-14", taken), "health-fair-2026-11-14-2");
  taken.add("health-fair-2026-11-14-2");
  assert.equal(eventSlug("Health Fair", "2026-11-14", taken), "health-fair-2026-11-14-3");
});

test("a title with no usable letters still gets a link, and long titles are trimmed cleanly", () => {
  assert.equal(eventSlug("!!!", "2026-11-14", new Set()), "event");
  const long = eventSlug("A ".repeat(60) + "Very Long Title", "2026-11-14", new Set());
  assert.ok(long.length <= 70 && !long.endsWith("-"), long);
});

test("regions: Caribbean and United States", () => {
  assert.ok(isEventRegion("caribbean") && isEventRegion("us"));
  assert.ok(!isEventRegion("mars") && !isEventRegion(undefined));
  assert.equal(regionLabel("us"), "United States");
  assert.equal(regionLabel(null), "Caribbean");
});

test("the state picks the time zone; Caribbean events keep Jamaica time", () => {
  assert.equal(US_STATES.length, 51); // 50 states + DC
  assert.equal(eventTimeZone({ region: "us", state: "GA" }), "America/New_York");
  assert.equal(eventTimeZone({ region: "us", state: "ca" }), "America/Los_Angeles");
  assert.equal(eventTimeZone({ region: "us", state: "HI" }), "Pacific/Honolulu");
  assert.equal(eventTimeZone({ region: "us", state: null }), "America/New_York");
  assert.equal(eventTimeZone({ region: "caribbean", state: "GA" }), "America/Jamaica");
  assert.equal(usState("tx")?.[1], "Texas");
  for (const [, , tz] of US_STATES) assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: tz }));
});

test("a Los Angeles event stays listed until midnight Pacific, not midnight Jamaica", () => {
  const starts = new Date("2026-11-14T12:00:00-05:00"); // how dates are stored: noon Eastern on the chosen day
  const tz = eventTimeZone({ region: "us", state: "CA" });
  assert.equal(isUpcomingEvent({ startsAt: starts, tz }, new Date("2026-11-15T07:30:00Z")), true); // 11:30 pm on the 14th in LA
  assert.equal(isUpcomingEvent({ startsAt: starts, tz }, new Date("2026-11-15T08:00:00Z")), false); // midnight in LA
});

test("location line combines the venue with city/state or country without repeating", () => {
  assert.equal(eventLocation({ region: "us", whereLabel: "Fulton County Library", city: "Atlanta", state: "GA" }), "Fulton County Library, Atlanta, GA");
  assert.equal(eventLocation({ region: "us", whereLabel: "TBA", city: "Atlanta", state: "GA" }), "TBA · Atlanta, GA");
  assert.equal(eventLocation({ region: "us", whereLabel: "", city: "Atlanta", state: "GA" }), "Atlanta, GA");
  assert.equal(eventLocation({ region: "us", whereLabel: "Online", city: null, state: null }), "Online");
  assert.equal(eventLocation({ region: "caribbean", whereLabel: "Kingston, Jamaica", country: "Jamaica" }), "Kingston, Jamaica");
  assert.equal(eventLocation({ region: "caribbean", whereLabel: "UWI Mona", country: "Jamaica" }), "UWI Mona, Jamaica");
});

test("an events block's filter: state and city only count for the United States", () => {
  assert.deepEqual(cleanEventFilter({ region: "us", state: "ga", city: " Atlanta " }), { region: "us", state: "GA", city: "Atlanta" });
  assert.deepEqual(cleanEventFilter({ region: "caribbean", state: "GA", city: "Atlanta" }), { region: "caribbean", state: "", city: "" });
  assert.deepEqual(cleanEventFilter({ region: "mars", state: "GA" }), { region: "", state: "", city: "" });
  assert.deepEqual(cleanEventFilter({ region: "us", state: "ZZ" }), { region: "us", state: "", city: "" });
});

test("filter labels for headings and empty lists", () => {
  assert.equal(eventFilterLabel({ region: "us", state: "GA", city: "Atlanta" }), "Atlanta, GA");
  assert.equal(eventFilterLabel({ region: "us", state: "GA" }), "Georgia");
  assert.equal(eventFilterLabel({ region: "us" }), "United States");
  assert.equal(eventFilterLabel({ region: "caribbean" }), "Caribbean");
  assert.equal(eventFilterLabel({}), "");
});

test("'See all events' links carry the block's filter to /events", () => {
  assert.equal(eventsHref({}), "/events");
  assert.equal(eventsHref({ region: "caribbean", state: "GA" }), "/events?region=caribbean");
  assert.equal(eventsHref({ region: "us", state: "GA", city: "Atlanta" }), "/events?region=us&state=GA&city=Atlanta");
});

test("Add block presets: United States, Caribbean, or every region", () => {
  assert.equal(eventsSection("us").region, "us");
  assert.equal(eventsSection("us").title, "Upcoming United States events");
  assert.equal(eventsSection("caribbean").region, "caribbean");
  assert.equal(eventsSection("").region, "");
  assert.equal(eventsSection("nonsense").region, "");
  const c = eventsSection("us");
  for (const k of ["state", "city", "limit", "showForm", "formEyebrow", "formBody"]) assert.ok(k in c, k); // every setting shows in the block editor
});
