/**
 * Product catalog seed for the AIP Products page (/healthy-home-resources/aip-products).
 * Each entry links out to the store that sells it (Amazon for the recommended products, Etsy for Grace's own downloads);
 * checkout happens there. `npm run db:seed` inserts these on an empty database; Admin → Products → "Import the previous
 * site's products" (or `npm run content:products`) adds the ones missing from an existing database, matched by URL, without
 * touching listings already edited in the admin.
 *
 * The recommended products are the "Recommended Products" list from the previous site (graceindesign.funnelpages.com/products),
 * in its original order. Descriptions condense each listing's feature bullets so they fit the card; the full bullets live on
 * Amazon. Links point at the matching Amazon product page (ASIN in the link, so the "Add to Amazon cart" button works); the
 * site adds the Associates tracking id from Site settings → Amazon shop. Photos, prices and ratings arrive with
 * "Refresh prices & photos" in Admin → Products.
 */
import { retailerFor, defaultType } from "../retailers";

export type ProductSeed = {
  url: string; title: string; category: string;
  description?: string; price?: string; image?: string | null; tag?: string | null; type?: string; featured?: boolean; active?: boolean;
};

export const ETSY_LISTING = "https://www.etsy.com/listing/4548113647/gid-home-readiness-assessment-aging-in";

/** The affiliate disclosure from the previous site's product page; printed under the product grid. */
export const AFFILIATE_DISCLOSURE = "Grace In Design Services, LLC is a participant in affiliate programs, including the Amazon Services LLC Associates Program. As an affiliate, we earn from qualifying purchases made through the links on our website. These affiliate relationships allow us to provide quality content and recommendations while earning a small commission at no additional cost to you.";

export const PRODUCTS: ProductSeed[] = [
  // --- Recommended products (previous site's list, original order) ---------------------------------------------------------
  {
    url: "https://www.amazon.com/dp/B0768BZNZP",
    title: "Energizer 4-in-1 LED Power Failure Night Light",
    description: "Four lights in one: a light-sensing night light that comes on at dusk, a power-failure light that switches on when the power goes out, a tabletop light and an emergency flashlight. It recharges while plugged in, with long-lasting LEDs and no bulbs or batteries to replace. For bedrooms, bathrooms, hallways and stairs.",
    category: "Lighting",
  },
  {
    url: "https://www.amazon.com/dp/B076BFV8PB",
    title: "SnapPower GuideLight 2 for Duplex Outlets",
    description: "An outlet cover plate with built-in LED night lights that snaps on in seconds, with no batteries, wires or brackets. Both sockets stay free, a dusk-to-dawn sensor turns the lights on when the room is dark, and it costs under ten cents a year to run.",
    category: "Lighting",
  },
  {
    url: "https://www.amazon.com/dp/B083FLZFX8",
    title: "GUND My Pet Puddles Animated Plush Puppy",
    description: "A soft 12-inch yellow lab puppy that reacts to touch: pat Puddles for tail wags and gentle yips, or tap his nose for a surprise. Embroidered features and a hidden, fastened battery compartment (three AA batteries included). A comforting companion and a thoughtful gift.",
    category: "Comfort & companionship",
  },
  {
    url: "https://www.amazon.com/dp/B0CN2XR3V3",
    title: "Suction Cup Safety Grab Bar for Bathtubs and Showers, 5-inch",
    description: "A no-drill grab bar with 5-inch suction cups rated over 418 lb and a red warning line that shows at a glance whether the cups are still holding. Fits smooth, non-porous surfaces at least 5.2 inches across: press the cups to the wall and pump until the red line disappears. Made to steady you, not to carry your full weight.",
    category: "Bathroom safety",
  },
  {
    url: "https://www.amazon.com/dp/B0CN2HJ91H",
    title: "Rechargeable Motion Sensor Under Cabinet Light, 40 LED",
    description: "A wireless light bar that switches on when it senses movement within 10 feet in the dark and off after about 20 seconds, with an always-on mode and five brightness levels behind a frosted, glare-free cover. USB-C rechargeable (one charge lasts weeks in sensor mode) and mounts with built-in magnets or the included adhesive plates. For counters, closets, stairs and hallways.",
    category: "Lighting",
  },
  {
    url: "https://www.amazon.com/dp/B001EHTPB8",
    title: "Moen 36-Inch Shower Grab Bar, Peened Stainless Steel (R8736P)",
    description: "ADA-compliant stainless steel grab bar with a textured, slip-resistant peened finish and concealed screws. Supports up to 500 lb when screwed into a wall stud or installed with Moen SecureMount anchors (sold separately). Backed by Moen's limited lifetime warranty.",
    category: "Bathroom safety",
  },
  {
    url: "https://www.amazon.com/dp/B01JF94TSU",
    title: "GE Wireless LED Puck Lights, Battery Operated, 2-Pack",
    description: "Stick-on, battery-powered puck lights you turn on and off with a touch, for closets, pantries, under cabinets, bookshelves and work areas. Cool-to-the-touch 20-lumen LEDs with no bulbs to replace; each light takes three AAA batteries (not included). Mounting hardware and a one-year limited warranty included.",
    category: "Lighting",
  },
  {
    url: "https://www.amazon.com/dp/B07VNWHZ4W",
    title: "MEETWARM Flip-Up Toilet Grab Bar Handrail",
    description: "A wall-mounted toilet safety rail in thick 304 stainless steel, rated to 600 lb. It folds flat against the wall when not in use (90° flip-up and 180° swing), has a non-slip textured nylon grip that stays warm in winter, and glow-in-the-dark rings so it can be found at night. Mounting hardware included.",
    category: "Bathroom safety",
  },
  {
    // The listing's color options (including Oil Rubbed Bronze) are chosen on the product page.
    url: "https://www.amazon.com/dp/B07FPW5ZNK",
    title: "BRIGHT SHOWERS Slide Bar Grab Rail Set with Handheld Shower Head, Oil Rubbed Bronze",
    description: "An ADA-compliant 23.6-inch stainless steel grab bar that doubles as a slide bar for the included five-setting handheld shower head and 69-inch hose. The push-button slider sets the shower height for seated showering, children or washing a pet; supports up to 250 lb. Wall elbow not included; limited lifetime warranty.",
    category: "Bathroom safety",
  },
  {
    url: "https://www.amazon.com/dp/B0C7HFMW91",
    title: "Agrish Bed Rail for Seniors with Motion Light and Storage Pouch",
    description: "A bedside assist bar with support legs that steadies you getting in and out of bed, plus a motion-activated LED light for night-time trips to the bathroom and a storage pouch. Steel construction, adjustable height, fits twin to California king beds and mattresses up to 16 inches thick (not for adjustable beds). FSA/HSA eligible.",
    category: "Bedroom",
  },
  {
    url: "https://www.amazon.com/dp/B086TPM48Y",
    title: "Medline Tub Transfer Bench, Adjustable, 400 lb Capacity",
    description: "A rust-resistant aluminum bench that spans the tub wall so you sit first, then slide in and out instead of stepping over. Push-button seat height from 17.5 to 22 inches, a reversible backrest for either side of the tub, an armrest, slip-resistant feet with suction cups inside the tub, and tool-free assembly. 400 lb weight capacity.",
    category: "Bathroom safety",
  },
  {
    url: "https://www.amazon.com/dp/B0C5M773VW",
    title: "SecuCaptain Emergency Fire Blanket, 2-Pack, 40 × 40 in",
    description: "Two 40 × 40 inch fiberglass fire blankets with heat-resistant pull tabs for smothering small kitchen, grill or fireplace fires without the mess of an extinguisher. Withstands up to 1076°F, never expires, and is simple enough for anyone to use: pull the tabs, cover the flames slowly, turn off the heat. Keep one in the kitchen and one in the car.",
    category: "Emergency preparedness",
  },
  {
    // Closest match to the previous site's title (RunningSnail 2000 mAh crank radio, 5 × 1.8 × 2.4 in); swap the link on its card if a different listing was meant.
    url: "https://www.amazon.com/dp/B01MFCFKG5",
    title: "Emergency Hand Crank Weather Radio with Flashlight and Power Bank",
    description: "A pocket-sized AM/FM and NOAA weather radio that keeps working when the power is out: charge it by hand crank, solar panel or USB, top up a phone for emergency calls from the built-in 2000 mAh battery, and light the way with the LED flashlight. About 5 inches long and half a pound.",
    category: "Emergency preparedness",
  },
  {
    url: "https://www.amazon.com/dp/1950724204",
    title: "My Loved One Has Dementia. Now What?",
    description: "Beth Dow's plain-language primer for families facing an Alzheimer's or dementia diagnosis: what the disease is, how to build a care team, how extended family and friends can support the primary caregiver, and why caregivers must look after themselves too. Paperback, 2019.",
    category: "Books & planning",
    type: "Paperback",
  },
  {
    url: "https://www.amazon.com/dp/B087GVXZRH",
    title: "Help Me Get My Stuff in Order: A Last Will and Testament Workbook",
    description: "A short large-print workbook by Georgia attorney Sharon Baker that walks you through the four parts of putting your Last Will and Testament in order, so your family is not left guessing.",
    category: "Books & planning",
    type: "Paperback, large print",
  },

  // --- Kept in the admin, hidden ------------------------------------------------------------------------------------------
  // Grace's own download. Hidden until the price/listing is confirmed in Admin → Products ("Refresh from Etsy", then "Show").
  { url: ETSY_LISTING, title: "GID Home Readiness Assessment — Aging In Place Checklist (PDF)", category: "Guides & checklists", image: "media://int.small-bath", featured: true, active: false },
  // Fitness items sent during the migration but not on the previous site's product page. One click ("Show") puts any of them on the page.
  { url: "https://www.amazon.com/s?k=CIVAGO+32+oz+Glass+Water+Bottle+with+Straw+and+Handle+Time+Marker+2+Lids", title: "CIVAGO 32 oz Glass Water Bottle with Straw and Handle", description: "Leakproof 32 oz glass bottle with time markers to pace your water through the day, a flip-up straw lid and an easy-twist spout lid, a carry handle, and a silicone sleeve for grip, impact protection and less condensation.", category: "Hydration", active: false },
  { url: "https://www.amazon.com/s?k=Resistance+Bands+Set+5+Resistance+Levels+Multi-Colored+Workout+Bands+Leg+Strength+Training+Yoga", title: "Resistance Band Set, 5 Resistance Levels", description: "Five color-coded latex loop bands, thicker than most, with resistance from about 10 lb to 115 lb when combined. Non-slip and odor-free, for strength work, stretching, yoga, rehabilitation and physical-therapy exercises at home, at work or outdoors.", category: "Movement", active: false },
  { url: "https://www.amazon.com/s?k=Amazfit+Bip+6+Smart+Watch+46mm+Charcoal", title: "Amazfit Bip 6 Smart Watch, 46 mm", description: "Lightweight aluminum smartwatch with a 1.97-inch AMOLED display, up to 14 days of battery, GPS with free downloadable maps, Bluetooth calls and texts, 140+ workout modes with AI coaching, and round-the-clock heart-rate, sleep, blood-oxygen and stress tracking. Water-resistant to 5 ATM.", category: "Health tracking", active: false },
  { url: "https://www.amazon.com/s?k=Resistance+Bands+with+Handles+Single+Resistance+Bands+Exercise+Bands+Physical+Therapy+Pilates", title: "Resistance Bands with Handles", description: "Five single natural-latex bands with comfortable non-slip handles, color-coded from 0–10 lb (yellow) to 40–50 lb (black), for low-impact strength training, physical therapy, stretching, Pilates and yoga. Comes with a travel pouch.", category: "Movement", active: false },
];

/** The database row for a seed entry. */
export function productRow(p: ProductSeed, sort: number) {
  const retailer = retailerFor(p.url);
  return { url: p.url, retailer, title: p.title, description: p.description ?? null, category: p.category, price: p.price || "$—", imageUrl: p.image ?? null, tag: p.tag ?? null, type: p.type ?? defaultType(retailer), reviews: "(0)", featured: !!p.featured, isActive: p.active !== false, sort };
}
