import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSlug, eventTimeZone, eventLocation, eventPath, isEventRegion, regionLabel, usState, US_STATES } from "../src/lib/events";
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
