/**
 * Google integration helpers (Analytics, Tag Manager, Search Console, Business Profile).
 * Pure functions only, so they can be unit tested (tests/google.test.ts) and used on both server and admin.
 *
 * Everything an admin pastes is normalised here before it is saved, and checked again before it reaches a
 * page: these values end up inside <script> tags and <meta> tags, so only the exact shapes Google issues are accepted.
 */

export type GoogleSettings = {
  /** GA4 Measurement ID, e.g. G-ABC123XYZ9. Empty falls back to NEXT_PUBLIC_GA_MEASUREMENT_ID. */
  gaMeasurementId: string;
  /** Google Tag Manager container, e.g. GTM-ABC1234. Optional. */
  gtmContainerId: string;
  /** Search Console "HTML tag" verification token (the content="..." value). */
  searchConsoleToken: string;
  /** Leave analytics off for signed-in team members so their own visits are not counted. */
  excludeTeam: boolean;
  /** Business Profile: the public Maps link to the listing (share link or maps URL). */
  profileUrl: string;
  /** Business Profile Place ID (starts with ChIJ…), used for the "write a review" link. */
  placeId: string;
  /** Show a "Review us on Google" link in the site footer when a Place ID is set. */
  footerReviewLink: boolean;
  /** "Embed a map" src from Google Maps → Share → Embed a map, used by the Google map page block. */
  mapEmbedUrl: string;
  /** Structured address for search engines. Must match the Business Profile exactly. */
  streetAddress: string;
  city: string;
  region: string;
  postalCode: string;
  /** Leave the street out of the structured data (service-area businesses that hide their address on Google). */
  hideStreet: boolean;
  /** Areas served, comma separated, e.g. "Atlanta, Marietta, Decatur". */
  areaServed: string;
  /** schema.org openingHours, e.g. "Mo-Fr 09:00-17:00". */
  openingHours: string;
};

export const GOOGLE_DEFAULTS: GoogleSettings = {
  gaMeasurementId: "", gtmContainerId: "", searchConsoleToken: "", excludeTeam: true,
  profileUrl: "", placeId: "", footerReviewLink: true, mapEmbedUrl: "",
  streetAddress: "", city: "Atlanta", region: "GA", postalCode: "", hideStreet: false, areaServed: "Metro Atlanta", openingHours: "Mo-Fr 09:00-17:00",
};

/** Result of normalising one admin field: the cleaned value, or an error message for the admin. */
type Norm = { value: string; error?: string };
const ok = (value: string): Norm => ({ value });
const bad = (error: string): Norm => ({ value: "", error });

export function normalizeGaId(input: string): Norm {
  const v = input.trim().toUpperCase();
  if (!v) return ok("");
  return /^G-[A-Z0-9]{4,16}$/.test(v) ? ok(v) : bad("The GA4 Measurement ID looks like G-ABC123XYZ9 (Admin → Data streams in Google Analytics). Universal Analytics IDs (UA-…) no longer work.");
}

export function normalizeGtmId(input: string): Norm {
  const v = input.trim().toUpperCase();
  if (!v) return ok("");
  return /^GTM-[A-Z0-9]{4,12}$/.test(v) ? ok(v) : bad("The Tag Manager container ID looks like GTM-ABC1234.");
}

/** Accepts the bare token or the whole <meta name="google-site-verification" content="…"> tag Google shows. */
export function normalizeSearchConsoleToken(input: string): Norm {
  let v = input.trim();
  if (!v) return ok("");
  const m = v.match(/content\s*=\s*["']([^"']+)["']/i);
  if (m) v = m[1].trim();
  return /^[A-Za-z0-9_-]{20,100}$/.test(v) ? ok(v) : bad("Paste the Search Console HTML tag (or just the code inside content=\"…\").");
}

export function normalizePlaceId(input: string): Norm {
  const v = input.trim();
  if (!v) return ok("");
  return /^[A-Za-z0-9_-]{10,300}$/.test(v) ? ok(v) : bad("A Place ID is a single code that usually starts with ChIJ (find it with Google's Place ID Finder).");
}

const GOOGLE_MAPS_HOSTS = /^(www\.)?google\.[a-z.]{2,6}$|^maps\.google\.[a-z.]{2,6}$|^maps\.app\.goo\.gl$|^goo\.gl$|^g\.page$|^business\.google\.com$|^share\.google$/;

/** The public link to the Business Profile. Only Google hosts over https. */
export function normalizeProfileUrl(input: string): Norm {
  const v = input.trim();
  if (!v) return ok("");
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && GOOGLE_MAPS_HOSTS.test(u.hostname)) return ok(u.toString());
  } catch { /* fall through */ }
  return bad("Use the Share link from your Google Business Profile or Google Maps listing (https://maps.app.goo.gl/… or https://www.google.com/maps/…).");
}

/** Accepts the iframe code from Maps → Share → Embed a map, or just its src. Only https://www.google.com/maps/embed URLs. */
export function normalizeMapEmbedUrl(input: string): Norm {
  let v = input.trim();
  if (!v) return ok("");
  const m = v.match(/src\s*=\s*["']([^"']+)["']/i);
  if (m) v = m[1].trim();
  v = v.replace(/&amp;/g, "&");
  try {
    const u = new URL(v);
    if (u.protocol === "https:" && /^(www\.)?google\.com$/.test(u.hostname) && u.pathname.startsWith("/maps/embed")) return ok(u.toString());
  } catch { /* fall through */ }
  return bad("Paste the code from Google Maps → Share → Embed a map (it starts with <iframe src=\"https://www.google.com/maps/embed…).");
}

/** Link that opens Google's "write a review" box for the business. */
export function reviewUrl(placeId: string): string {
  return placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : "";
}

/** Website address to put in the Business Profile, tagged so Analytics shows visits that came from the listing. */
export function trackedProfileWebsiteUrl(baseUrl: string): string {
  const u = new URL("/", baseUrl);
  u.searchParams.set("utm_source", "google");
  u.searchParams.set("utm_medium", "organic");
  u.searchParams.set("utm_campaign", "business_profile");
  return u.toString();
}

/** Re-validated at render time, so a value edited straight in the database still cannot break out of a script. */
export function safeGaId(v: string | undefined | null) { return v && /^G-[A-Z0-9]{4,16}$/.test(v) ? v : ""; }
export function safeGtmId(v: string | undefined | null) { return v && /^GTM-[A-Z0-9]{4,12}$/.test(v) ? v : ""; }
export function safeSearchConsoleToken(v: string | undefined | null) { return v && /^[A-Za-z0-9_-]{20,100}$/.test(v) ? v : ""; }
export function safeMapEmbedUrl(v: string | undefined | null) { return v && !normalizeMapEmbedUrl(v).error ? normalizeMapEmbedUrl(v).value : ""; }

/**
 * schema.org LocalBusiness data. Tells Google this website and the Business Profile are the same business,
 * using the same name, phone, address and hours the profile shows.
 */
export function buildLocalBusinessJsonLd(input: {
  baseUrl: string;
  name: string;
  description: string;
  phone: string;
  email: string;
  logoPath: string;
  google: GoogleSettings;
  sameAs: string[];
}): Record<string, unknown> {
  const g = input.google;
  const base = input.baseUrl.replace(/\/+$/, "");
  const address: Record<string, string> = { "@type": "PostalAddress" };
  if (g.streetAddress && !g.hideStreet) address.streetAddress = g.streetAddress;
  if (g.city) address.addressLocality = g.city;
  if (g.region) address.addressRegion = g.region;
  if (g.postalCode) address.postalCode = g.postalCode;
  const hasAddress = Object.keys(address).length > 1;
  if (hasAddress) address.addressCountry = "US";
  const areas = g.areaServed.split(",").map((s) => s.trim()).filter(Boolean);
  const sameAs = [g.profileUrl, ...input.sameAs].filter((u, i, a) => !!u && /^https:\/\//.test(u) && a.indexOf(u) === i);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${base}/#business`,
    name: input.name,
    url: `${base}/`,
    logo: `${base}${input.logoPath}`,
    image: `${base}${input.logoPath}`,
  };
  if (input.description) data.description = input.description;
  if (input.phone) data.telephone = input.phone;
  if (input.email) data.email = input.email;
  if (hasAddress) data.address = address;
  if (areas.length) data.areaServed = areas.map((name) => ({ "@type": "Place", name }));
  if (g.openingHours.trim()) data.openingHours = g.openingHours.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  if (g.profileUrl) data.hasMap = g.profileUrl;
  if (sameAs.length) data.sameAs = sameAs;
  return data;
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so text can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
