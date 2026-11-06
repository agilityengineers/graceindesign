/**
 * AIP Partners directory: the rules shared by the public page, the admin screen and the tests (no database access here).
 * Listings are curated by GID; each professional operates independently.
 */

/** Suggested categories in the admin (free text is allowed; the public filters come from the published listings). */
export const PARTNER_CATEGORIES = [
  "Occupational therapy",
  "Contractors & remodelers",
  "Accessibility installers",
  "Real estate",
  "Home health & care",
  "Senior living & transitions",
  "Legal & financial",
  "Other",
] as const;

export type PartnerCard = { id: number; name: string; specialty: string; category: string; description: string; url: string; image: string; location: string };

/**
 * The categories visitors can filter by: one per published listing category, in the order of the suggested list first
 * (so the page reads the same way the admin is organised), then any custom categories alphabetically.
 */
export function partnerCategories(rows: { category: string }[]): string[] {
  const seen = new Set(rows.map((r) => r.category.trim()).filter(Boolean));
  const known = PARTNER_CATEGORIES.filter((c) => seen.has(c));
  const custom = [...seen].filter((c) => !(PARTNER_CATEGORIES as readonly string[]).includes(c)).sort((a, b) => a.localeCompare(b));
  // "Other" reads best last, even when the admin added custom categories.
  const ordered = [...known.filter((c) => c !== "Other"), ...custom];
  return seen.has("Other") ? [...ordered, "Other"] : ordered;
}

/** Listings grouped under their category, in partnerCategories order; within a group the order they arrive in (sort, then name). */
export function groupPartners<T extends { category: string }>(rows: T[]): [string, T[]][] {
  return partnerCategories(rows).map((c) => [c, rows.filter((r) => r.category.trim() === c)] as [string, T[]]).filter(([, list]) => list.length > 0);
}

/** A website as typed by an admin ("example.com", "www.example.com/x") → a safe absolute http(s) link, or "" when it isn't one. */
export function normalizePartnerUrl(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname.includes(".")) return "";
    return u.toString();
  } catch { return ""; }
}

/** The host shown on the card's link ("example.com"), without "www.". */
export function partnerUrlLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** Two initials for a listing without a photo. */
export function partnerInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s&-]/gu, " ").split(/\s+/).filter((w) => w && w !== "&" && w !== "-");
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
}

/** The page AIP Partners renders from (Admin → Content → Pages), created on first visit when a database predates it. */
export const PARTNERS_PAGE = {
  key: "aip-partners",
  slug: "/healthy-home-resources/aip-partners",
  title: "AIP Partners",
  navLabel: "Healthy Home Resources · AIP Partners",
  parentKey: "hhr",
  seoTitle: "AIP Partners · Grace In Design",
  seoDescription: "A curated directory of Aging In Place professionals Grace In Design knows or has worked with: occupational therapists, contractors, installers, realtors and more.",
  blocks: [
    { type: "page_header", content: { crumb: "Healthy Home Resources", crumbHref: "/healthy-home-resources", eyebrow: "Healthy Home Resources", title: "AIP Partners", body: "Professionals and businesses we know or have worked with, who share our commitment to safe, comfortable homes for every stage of life. Browse by specialty and reach out to them directly." } },
    { type: "partner_directory", content: { eyebrow: "Partner Directory", title: "Trusted Aging In Place professionals", note: "Each professional listed here runs an independent business. Grace In Design does not employ, manage or guarantee their services — please contact them directly and confirm licensing, insurance and pricing for your project.", empty: "Our partner directory is being put together. Check back soon." } },
  ],
} as const;
