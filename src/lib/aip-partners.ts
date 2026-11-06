/**
 * Categories for the AIP Partners directory (/healthy-home-resources/aip-partners).
 * Kept in code rather than a table: the list is short and stable, and adding one is a one-line change here.
 * `aip_partners.category` stores the key; renaming a label is safe, changing a key orphans existing listings.
 */
export const AIP_PARTNER_CATEGORIES = [
  { key: "home-modification", label: "Home Modification", hint: "Remodelers, accessibility contractors, installers" },
  { key: "healthcare-therapy", label: "Healthcare & Therapy", hint: "Occupational therapists, physical therapists" },
  { key: "home-care", label: "Home Care & Support", hint: "Home care providers, care managers" },
  { key: "real-estate", label: "Real Estate & Relocation", hint: "Realtors, senior relocation specialists" },
  { key: "home-organization", label: "Home Organization", hint: "Professional organizers, downsizing specialists" },
  { key: "specialized", label: "Specialized Services", hint: "Other trusted professional contacts" },
] as const;

export type AipPartnerCategory = (typeof AIP_PARTNER_CATEGORIES)[number]["key"];

export function isAipPartnerCategory(v: string): v is AipPartnerCategory {
  return AIP_PARTNER_CATEGORIES.some((c) => c.key === v);
}

/** Display label for a stored category key; falls back to the last category for an unknown key. */
export function aipPartnerCategoryLabel(key: string): string {
  return (AIP_PARTNER_CATEGORIES.find((c) => c.key === key) ?? AIP_PARTNER_CATEGORIES[AIP_PARTNER_CATEGORIES.length - 1]).label;
}

/**
 * Normalise a website typed into the admin: adds https:// when no scheme is given and accepts only http(s).
 * Returns null for an empty value; throws for anything that isn't a usable web address.
 */
export function normalizeWebsite(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw new Error("Website must be a web address, e.g. example.com"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Website must start with http:// or https://");
  if (!u.hostname.includes(".")) throw new Error("Website must be a web address, e.g. example.com");
  return u.toString();
}

/** How GID knows a partner, shown as a badge on the card. */
export const AIP_PARTNER_RELATIONSHIPS = [
  { key: "collaborator", label: "GID collaborator", hint: "We have worked on projects together" },
  { key: "known", label: "Known professional", hint: "A professional we know and trust" },
] as const;

export type AipPartnerRelationship = (typeof AIP_PARTNER_RELATIONSHIPS)[number]["key"];

export function isAipPartnerRelationship(v: string): v is AipPartnerRelationship {
  return AIP_PARTNER_RELATIONSHIPS.some((r) => r.key === v);
}

export function aipPartnerRelationshipLabel(key: string): string {
  return (AIP_PARTNER_RELATIONSHIPS.find((r) => r.key === key) ?? AIP_PARTNER_RELATIONSHIPS[1]).label;
}

/** How a listing's image is shown: a logo whole on a light tile, or a photo cropped to fill it. Anything else is a logo. */
export type AipPartnerImageKind = "logo" | "photo";
export function partnerImageKind(v: string | null | undefined): AipPartnerImageKind {
  return v === "photo" ? "photo" : "logo";
}
