/**
 * Per-event counters: page views, clicks on Register, calendar downloads and share-button clicks.
 * Like the tally a door counter keeps: it says how many came in and how many went on to register, not who they were.
 * No cookies or personal data are stored; a view is counted once per browser tab session.
 *
 * Pure functions (no database), shared by the API routes, the admin and `npm run test:events`.
 */

/** What the browser can report about an event page. Register clicks and calendar downloads are counted on the server instead. */
export const BEACON_KINDS = ["view", "share"] as const;
export type BeaconKind = (typeof BEACON_KINDS)[number];
export function isBeaconKind(v: unknown): v is BeaconKind { return BEACON_KINDS.some((k) => k === v); }

/** Search engines, link-preview fetchers (the "card" a shared link shows) and uptime checkers: not people, so not counted. */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|linkedin|pinterest|vkshare|quora|curl|wget|python|node-fetch|axios|go-http|java\/|headless|lighthouse|monitor|uptime|pingdom/i;
export function isBot(userAgent: string | null | undefined): boolean { return !userAgent || BOT.test(userAgent); }

/** Register clicks as a share of views, e.g. "12%". "—" until there are views to compare against. */
export function clickRate(views: number, clicks: number): string {
  if (!views) return "—";
  const pct = (100 * clicks) / views;
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%`;
}

/**
 * The registration link /events/<slug>/register forwards to: http(s) only. A link typed without "https://"
 * ("www.eventbrite.com/e/…") gets it added; anything else (javascript:, mailto:, text) is refused.
 */
export function safeRegistrationUrl(url: string | null | undefined): string | null {
  let v = (url || "").trim(); if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) { if (!/^[\w-]+(\.[\w-]+)+([/?#:]|$)/.test(v)) return null; v = `https://${v}`; }
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
}
