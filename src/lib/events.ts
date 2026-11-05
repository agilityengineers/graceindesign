/**
 * Events in any region, each with its own shareable page at /events/<slug>.
 *
 * Think of the old setup as flyers pinned to one notice board (the Caribbean Connection page): you
 * could only send people to the board. Now each approved flyer also gets its own address, so it can
 * be handed out anywhere (social posts, emails, texts), and the board still shows it too.
 *
 * Pure functions with no database access, so the public pages, the admin and the tests
 * (`npm run test:events`) share one definition of regions, links and locations.
 */
import { slugify } from "./utils";

export const EVENT_REGIONS = [
  { key: "caribbean", label: "Caribbean" },
  { key: "us", label: "United States" },
] as const;
export type EventRegion = (typeof EVENT_REGIONS)[number]["key"];
export const DEFAULT_EVENT_REGION: EventRegion = "caribbean";
export function isEventRegion(v: unknown): v is EventRegion { return EVENT_REGIONS.some((r) => r.key === v); }
export function regionLabel(v: string | null | undefined): string { return EVENT_REGIONS.find((r) => r.key === v)?.label || "Caribbean"; }

/** US states + DC with the IANA zone most of the state uses. Picking the state sets the event's time zone, so it drops off at local midnight. */
export const US_STATES = [
  ["AL", "Alabama", "America/Chicago"], ["AK", "Alaska", "America/Anchorage"], ["AZ", "Arizona", "America/Phoenix"], ["AR", "Arkansas", "America/Chicago"],
  ["CA", "California", "America/Los_Angeles"], ["CO", "Colorado", "America/Denver"], ["CT", "Connecticut", "America/New_York"], ["DE", "Delaware", "America/New_York"],
  ["DC", "District of Columbia", "America/New_York"], ["FL", "Florida", "America/New_York"], ["GA", "Georgia", "America/New_York"], ["HI", "Hawaii", "Pacific/Honolulu"],
  ["ID", "Idaho", "America/Boise"], ["IL", "Illinois", "America/Chicago"], ["IN", "Indiana", "America/Indiana/Indianapolis"], ["IA", "Iowa", "America/Chicago"],
  ["KS", "Kansas", "America/Chicago"], ["KY", "Kentucky", "America/New_York"], ["LA", "Louisiana", "America/Chicago"], ["ME", "Maine", "America/New_York"],
  ["MD", "Maryland", "America/New_York"], ["MA", "Massachusetts", "America/New_York"], ["MI", "Michigan", "America/Detroit"], ["MN", "Minnesota", "America/Chicago"],
  ["MS", "Mississippi", "America/Chicago"], ["MO", "Missouri", "America/Chicago"], ["MT", "Montana", "America/Denver"], ["NE", "Nebraska", "America/Chicago"],
  ["NV", "Nevada", "America/Los_Angeles"], ["NH", "New Hampshire", "America/New_York"], ["NJ", "New Jersey", "America/New_York"], ["NM", "New Mexico", "America/Denver"],
  ["NY", "New York", "America/New_York"], ["NC", "North Carolina", "America/New_York"], ["ND", "North Dakota", "America/Chicago"], ["OH", "Ohio", "America/New_York"],
  ["OK", "Oklahoma", "America/Chicago"], ["OR", "Oregon", "America/Los_Angeles"], ["PA", "Pennsylvania", "America/New_York"], ["RI", "Rhode Island", "America/New_York"],
  ["SC", "South Carolina", "America/New_York"], ["SD", "South Dakota", "America/Chicago"], ["TN", "Tennessee", "America/Chicago"], ["TX", "Texas", "America/Chicago"],
  ["UT", "Utah", "America/Denver"], ["VT", "Vermont", "America/New_York"], ["VA", "Virginia", "America/New_York"], ["WA", "Washington", "America/Los_Angeles"],
  ["WV", "West Virginia", "America/New_York"], ["WI", "Wisconsin", "America/Chicago"], ["WY", "Wyoming", "America/Denver"],
] as const;
export function usState(code: string | null | undefined) { const c = (code || "").toUpperCase(); return US_STATES.find((s) => s[0] === c) || null; }

/** Matches the `cc_events.tz` column default (see also src/lib/cc-events.ts). */
const CARIBBEAN_TZ = "America/Jamaica";
const US_FALLBACK_TZ = "America/New_York";
/** The event's time zone, from where it is: a US state's zone, otherwise Caribbean time. */
export function eventTimeZone(e: { region?: string | null; state?: string | null }): string {
  if (e.region === "us") return usState(e.state)?.[2] || US_FALLBACK_TZ;
  return CARIBBEAN_TZ;
}

/** "Kingston, Jamaica", "Atlanta, GA", "Online"… the venue line plus the city/state or country, without repeating either. */
export function eventLocation(e: { region?: string | null; whereLabel?: string | null; city?: string | null; state?: string | null; country?: string | null }): string {
  const where = (e.whereLabel || "").trim();
  const place = e.region === "us"
    ? [e.city?.trim(), usState(e.state)?.[0]].filter(Boolean).join(", ")
    : (e.country || "").trim();
  if (!place || where.toLowerCase().includes(place.toLowerCase())) return where || place;
  if (!where || /^(online|tba)$/i.test(where)) return where ? `${where} · ${place}` : place;
  return `${where}, ${place}`;
}

/** Public path of an event page. */
export function eventPath(slug: string) { return `/events/${slug}`; }

/**
 * The link's slug, made from the title ("Fall-Prevention Workshop" → "fall-prevention-workshop"). When another event
 * already has it, the date is added, then a counter: "…-2026-11-14", "…-2026-11-14-2". Readable words in the URL are what
 * search engines and people sharing the link both like.
 */
export function eventSlug(title: string, day: string, taken: ReadonlySet<string>): string {
  const base = slugify(title).slice(0, 70).replace(/-+$/, "") || "event";
  if (!taken.has(base)) return base;
  const dated = `${base}-${day}`;
  if (!taken.has(dated)) return dated;
  for (let n = 2; ; n++) if (!taken.has(`${dated}-${n}`)) return `${dated}-${n}`;
}
