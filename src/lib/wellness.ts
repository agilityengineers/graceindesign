/**
 * WELLness Resources: the WELL concept groups and their resource cards.
 *
 * They live in the `wellness_groups` page block's content (`groups`), so they are edited in Admin → Content →
 * WELLness Resources like any other block. `DEFAULT_WELL_GROUPS` is the starting set (the ten WELL concepts, with
 * the original guides filed under Light, Air, Movement and Water) and the fallback for a block saved before
 * `groups` existed. A concept with no resources yet is hidden on the public page.
 */
import { WELLNESS_GROUPS } from "./seed-data/demo";

export type WellResource = { kind: string; title: string; desc: string; img: string; href: string };
export type WellGroup = { letter: string; title: string; sub: string; resources: WellResource[] };

/** The category News & Insights posts use to appear on the WELLness Resources page and in its RSS feed. */
export const WELLNESS_CATEGORY = "WELLness";

const legacy = (title: string): WellResource[] =>
  (WELLNESS_GROUPS.find((g) => g.title === title)?.items || []).map(([kind, t, desc, img]) => ({ kind, title: t, desc, img, href: "" }));

export const DEFAULT_WELL_GROUPS: WellGroup[] = [
  { letter: "A", title: "Air", sub: "Ventilation, low-VOC materials and plants that help", resources: legacy("Air") },
  { letter: "W", title: "Water", sub: "Safe, comfortable bathrooms, flooring and water at home", resources: legacy("Water & Comfort") },
  { letter: "N", title: "Nourishment", sub: "Kitchens that make healthy cooking and eating easy", resources: [] },
  { letter: "L", title: "Light", sub: "Daylight, circadian rhythm and glare-free task lighting", resources: legacy("Light") },
  { letter: "M", title: "Movement", sub: "Clear paths, reachable storage and barrier-free design", resources: legacy("Movement") },
  { letter: "T", title: "Thermal Comfort", sub: "Temperature, drafts and humidity, room by room", resources: [] },
  { letter: "S", title: "Sound", sub: "Quieter rooms, better sleep and easier conversation", resources: [] },
  { letter: "Ma", title: "Materials", sub: "Finishes, furniture and cleaning products with fewer toxins", resources: [] },
  { letter: "Mi", title: "Mind", sub: "Calm, clutter-free spaces that support how you feel", resources: [] },
  { letter: "C", title: "Community", sub: "Homes that welcome family, friends and caregivers", resources: [] },
];

/** The default walk-through items: used for the generated PDF when the admin hasn't uploaded their own. */
export const DEFAULT_WALKTHROUGH_ITEMS = [
  "Light: can you see the floor clearly on the path from bed to bathroom at night?",
  "Air: do bathrooms and kitchen vent outside? Any musty smell?",
  "Water: are hot water temperatures set below 120°F? Any slow leaks?",
  "Safety: loose rugs, cords across walkways, missing grab bars?",
  "Entry: at least one step-free way in, or a plan for one?",
  "Reach: can everyday items be reached without a step stool?",
];

/** The groups a `wellness_groups` block shows: its own `groups`, or the defaults for a block saved before they were editable. */
export function wellGroupsOf(content: unknown): WellGroup[] {
  const groups = content && typeof content === "object" ? (content as { groups?: unknown }).groups : undefined;
  if (!Array.isArray(groups)) return DEFAULT_WELL_GROUPS;
  return groups.filter((g): g is WellGroup => !!g && typeof g === "object").map((g) => ({
    letter: String(g.letter || ""), title: String(g.title || ""), sub: String(g.sub || ""),
    resources: (Array.isArray(g.resources) ? g.resources : []).filter((r) => r && typeof r === "object" && r.title).map((r) => ({ kind: String(r.kind || ""), title: String(r.title), desc: String(r.desc || ""), img: String(r.img || ""), href: String(r.href || "") })),
  }));
}

/**
 * The walk-through sidebar's default wording (Admin → Content → WELLness Resources → the WELL concepts block → Lead magnet).
 * Also the fallback the download page and the checklist email use for any field the admin left blank.
 */
export const DEFAULT_LEAD_MAGNET = { eyebrow: "Free download", title: "The 10-Minute Healthy Home Walk-Through", body: "Our quick checklist for light, air, water and safety — the same one our specialists start with.", cta: "Send me the checklist", link: "Or request a full home assessment →", linkHref: "/contact?from=wellness", pdf: "", items: DEFAULT_WALKTHROUGH_ITEMS };

/** Starter content for a new `wellness_groups` block (Admin → Content → + Add block). */
export function wellnessGroupsStarter() {
  return { groups: DEFAULT_WELL_GROUPS, leadMagnet: { ...DEFAULT_LEAD_MAGNET } };
}

/** Starter content for the "Latest WELLness articles" row: a `news` block limited to the WELLness category. */
export function wellnessNewsStarter() {
  return { eyebrow: "WELLness articles", title: "Healthier homes, workplaces and spaces", linkLabel: "All WELLness articles", linkHref: `/news?category=${WELLNESS_CATEGORY}`, count: 3, categories: [WELLNESS_CATEGORY] };
}

/** True when a link points at a downloadable document rather than a page. */
export const isDownload = (href: string) => /\.pdf(\?|#|$)/i.test(href);
