/**
 * Product catalog seed for the AIP Products page (/healthy-home-resources/aip-products).
 * Each entry links out to the store that sells it (Amazon for the curated home-safety picks, Etsy for Grace's own downloads);
 * checkout happens there. `npm run db:seed` inserts these on an empty database; `npm run content:products` adds the ones
 * missing from an existing database (matched by URL) without touching listings already edited in the admin.
 * Amazon picks also start on the "wellness" shelf (WELLness-Products at the bottom of Healthy Home Resources); Admin → Products stocks it.
 */
import { retailerFor, defaultType } from "../retailers";
import type { ShelfKey } from "../shelves";

export type ProductSeed = {
  url: string; title: string; category: string;
  description?: string; price?: string; image?: string | null; tag?: string | null; type?: string; featured?: boolean; active?: boolean;
  /** Shelves the listing starts on; Amazon listings default to the WELLness-Products shelf, everything else to none. */
  shelves?: ShelfKey[];
};

export const ETSY_LISTING = "https://www.etsy.com/listing/4548113647/gid-home-readiness-assessment-aging-in";

export const PRODUCTS: ProductSeed[] = [
  // Grace's own download. Hidden until the price/listing is confirmed in Admin → Products ("Refresh from Etsy", then "Show").
  { url: ETSY_LISTING, title: "GID Home Readiness Assessment — Aging In Place Checklist (PDF)", category: "Guides & checklists", image: "media://int.small-bath", featured: true, active: false },
  // Amazon picks carried over from the previous site's product page (https://graceindesign.funnelpages.com/products).
  // The links are Amazon searches for the exact product until the listing URLs from the old page (with any affiliate tag) are pasted
  // into Admin → Products → "Product link"; "Refresh from Amazon" then pulls the photo, price and rating. Descriptions condense the
  // listings' feature bullets so they fit the card.
  {
    url: "https://www.amazon.com/s?k=CIVAGO+32+oz+Glass+Water+Bottle+with+Straw+and+Handle+Time+Marker+2+Lids",
    title: "CIVAGO 32 oz Glass Water Bottle with Straw and Handle",
    description: "Leakproof 32 oz glass bottle with time markers to pace your water through the day, a flip-up straw lid and an easy-twist spout lid, a carry handle, and a silicone sleeve for grip, impact protection and less condensation.",
    category: "Hydration",
  },
  {
    url: "https://www.amazon.com/s?k=Resistance+Bands+Set+5+Resistance+Levels+Multi-Colored+Workout+Bands+Leg+Strength+Training+Yoga",
    title: "Resistance Band Set, 5 Resistance Levels",
    description: "Five color-coded latex loop bands, thicker than most, with resistance from about 10 lb to 115 lb when combined. Non-slip and odor-free, for strength work, stretching, yoga, rehabilitation and physical-therapy exercises at home, at work or outdoors.",
    category: "Movement",
  },
  {
    url: "https://www.amazon.com/s?k=Amazfit+Bip+6+Smart+Watch+46mm+Charcoal",
    title: "Amazfit Bip 6 Smart Watch, 46 mm",
    description: "Lightweight aluminum smartwatch with a 1.97-inch AMOLED display, up to 14 days of battery, GPS with free downloadable maps, Bluetooth calls and texts, 140+ workout modes with AI coaching, and round-the-clock heart-rate, sleep, blood-oxygen and stress tracking. Water-resistant to 5 ATM.",
    category: "Health tracking",
  },
  {
    url: "https://www.amazon.com/s?k=Resistance+Bands+with+Handles+Single+Resistance+Bands+Exercise+Bands+Physical+Therapy+Pilates",
    title: "Resistance Bands with Handles",
    description: "Five single natural-latex bands with comfortable non-slip handles, color-coded from 0–10 lb (yellow) to 40–50 lb (black), for low-impact strength training, physical therapy, stretching, Pilates and yoga. Comes with a travel pouch.",
    category: "Movement",
  },
];

/** Shelves a seed entry starts on when it names none: Amazon picks go on WELLness-Products. */
export function defaultShelves(retailer: string): ShelfKey[] { return retailer === "amazon" ? ["wellness"] : []; }

/** The database row for a seed entry. */
export function productRow(p: ProductSeed, sort: number) {
  const retailer = retailerFor(p.url);
  return { url: p.url, retailer, title: p.title, description: p.description ?? null, category: p.category, price: p.price || "$—", imageUrl: p.image ?? null, tag: p.tag ?? null, type: p.type ?? defaultType(retailer), reviews: "(0)", featured: !!p.featured, shelves: p.shelves ?? defaultShelves(retailer), isActive: p.active !== false, sort };
}
