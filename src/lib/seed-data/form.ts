// Ported verbatim from design/form-schema.js
export const PATHS = [
  { id: "residential", label: "Homeowner — Residential Design", short: "Residential", pages: ["residential"], consult: "15-min discovery call", color: "#6cb6e6" },
  { id: "design-refresh", label: "Homeowner — Design Refresh", short: "Design Refresh", pages: ["design-refresh"], consult: "15-min discovery call", color: "#6cb6e6" },
  { id: "aging-in-place", label: "Senior or Caregiver — Aging In Place", short: "Aging In Place", pages: ["aging-in-place", "hhr", "aip-products", "wellness", "home-health"], consult: "15-min discovery call", color: "#3f9ad9" },
  { id: "virtual-assessment", label: "Senior or Caregiver — Virtual Home Assessment", short: "Virtual Assessment", pages: ["virtual-assessment"], consult: "15-min discovery call", color: "#3f9ad9" },
  { id: "commercial", label: "Business — Commercial Interiors", short: "Commercial", pages: ["commercial"], consult: "15-min discovery call", color: "#1a2238" },
  { id: "model-home", label: "Builder or Developer — Model Home", short: "Model Home", pages: ["model-home"], consult: "15-min developer consultation", color: "#1a2238" },
  { id: "project-management", label: "Owner — Project Management", short: "Project Mgmt", pages: ["project-management"], consult: "15-min discovery call", color: "#4b5569" },
];

export type SeedField = { key: string; label: string; type: string; options?: string[]; required?: boolean; step?: string; placeholder?: string };
export const BASE_FIELDS: SeedField[] = [
  { key: "name", label: "Full name", type: "text", required: true, step: "contact" },
  { key: "email", label: "Email", type: "email", required: true, step: "contact" },
  { key: "phone", label: "Phone", type: "phone", required: true, step: "contact" },
  { key: "contact_pref", label: "Preferred contact method", type: "select", options: ["Email", "Phone call", "Text message"], required: true, step: "contact" },
  { key: "contact_time", label: "Best time to reach you", type: "select", options: ["Morning", "Afternoon", "Evening", "Any time"], step: "contact" },
  { key: "address", label: "Property address", type: "address", step: "project" },
  { key: "timeline", label: "Timeline", type: "select", options: ["As soon as possible", "1–3 months", "3–6 months", "6+ months", "Just exploring"], required: true, step: "project" },
  { key: "budget", label: "Budget range", type: "select", options: ["Not sure yet", "Under $10k", "$10k–$50k", "$50k–$150k", "$150k+"], step: "project" },
  { key: "decision", label: "Who else is involved in the decision?", type: "select", options: ["Just me", "Spouse / partner", "Family member", "Business partner", "Board / committee"], step: "project" },
  { key: "photos", label: "Photos of the space (optional)", type: "upload", step: "project" },
  { key: "notes", label: "Tell us about your project", type: "textarea", step: "project" },
  { key: "source", label: "How did you hear about us?", type: "select", options: ["Google search", "Referral", "Social media", "Etsy shop", "Event or workshop", "Other"], step: "review" },
  { key: "consent", label: "I agree to be contacted by email or text about my request", type: "consent", required: true, step: "review" },
];
export const PATH_FIELDS: Record<string, SeedField[]> = {
  residential: [
    { key: "rooms", label: "Which rooms?", type: "multiselect", options: ["Kitchen", "Bathroom", "Primary bedroom", "Living room", "Home office", "Whole home"], required: true },
    { key: "owner", label: "Do you own the home?", type: "select", options: ["Yes", "Renting", "Buying soon"] },
    { key: "style", label: "Style words that describe you", type: "text", placeholder: "e.g. warm, modern, uncluttered" },
  ],
  "design-refresh": [
    { key: "rooms", label: "Rooms to refresh", type: "select", options: ["One room", "2–3 rooms", "Whole home"], required: true },
    { key: "keep", label: "Keep existing furniture?", type: "select", options: ["Mostly yes", "Some", "Open to replacing"] },
    { key: "event", label: "Is there a date you need it done by?", type: "date" },
  ],
  "aging-in-place": [
    { key: "who", label: "Who is the home for?", type: "select", options: ["Myself", "A parent or relative", "A client I care for"], required: true },
    { key: "mobility", label: "Mobility aids used today", type: "multiselect", options: ["None", "Cane", "Walker", "Wheelchair", "Not sure"] },
    { key: "concerns", label: "Biggest concerns", type: "multiselect", options: ["Bathroom safety", "Stairs / entry", "Kitchen access", "Lighting", "Falls", "Caregiver access"], required: true },
    { key: "home_type", label: "Home type", type: "select", options: ["Single-story", "Two-story", "Condo / apartment", "Townhome"] },
  ],
  "virtual-assessment": [
    { key: "who", label: "Who is the home for?", type: "select", options: ["Myself", "A parent or relative", "A client I care for"], required: true },
    { key: "home_location", label: "Where is the home?", type: "text", placeholder: "City, State", required: true },
    { key: "format", label: "Preferred format", type: "select", options: ["Live video walkthrough", "Photo & video review", "Virtual + family briefing", "Not sure"], required: true },
    { key: "concerns", label: "Biggest concerns", type: "multiselect", options: ["Bathroom safety", "Stairs / entry", "Kitchen access", "Lighting", "Recent fall", "General check-up"], required: true },
    { key: "tech", label: "Comfortable with video calls?", type: "select", options: ["Yes", "With help from family", "Prefer photos only"] },
  ],
  commercial: [
    { key: "company", label: "Company", type: "text", required: true },
    { key: "space_type", label: "Space type", type: "select", options: ["Office", "Healthcare / wellness", "Hospitality / retail", "Mixed use"], required: true },
    { key: "sqft", label: "Approximate square footage", type: "select", options: ["Under 2,000", "2,000–10,000", "10,000–50,000", "50,000+"] },
    { key: "occupied", label: "Will the space be occupied during work?", type: "select", options: ["Yes", "No", "Partially"] },
  ],
  "model-home": [
    { key: "company", label: "Company / community name", type: "text", required: true },
    { key: "role", label: "I am a…", type: "select", options: ["Builder / developer", "Real estate agent or broker", "Property manager", "Other"], required: true },
    { key: "models", label: "Number of models", type: "select", options: ["1", "2–3", "4+"] },
    { key: "tier", label: "Service tier of interest", type: "select", options: ["Market Ready", "Essential", "Premium Model Home", "Not sure"] },
    { key: "opening", label: "Target opening date", type: "date" },
  ],
  "project-management": [
    { key: "ptype", label: "Project type", type: "select", options: ["Residential renovation", "Commercial build-out", "New construction"], required: true },
    { key: "have", label: "Do you have plans or a contractor?", type: "select", options: ["Plans only", "Contractor only", "Both", "Neither yet"] },
    { key: "size", label: "Estimated project value", type: "select", options: ["Under $50k", "$50k–$250k", "$250k–$1M", "$1M+"] },
  ],
};
export const STEPS = [
  { id: "path", label: "About you" },
  { id: "project", label: "Your project" },
  { id: "contact", label: "Contact" },
  { id: "schedule", label: "Pick a time" },
  { id: "review", label: "Confirm" },
];
export const PAGE_TO_PATH: Record<string, string | null> = { home: null, general: null, residential: "residential", "design-refresh": "design-refresh", "model-home": "model-home", "aging-in-place": "aging-in-place", "virtual-assessment": "virtual-assessment", commercial: "commercial", "project-management": "project-management", "aip-partners": null, hhr: "aging-in-place", "aip-products": "aging-in-place", wellness: "aging-in-place", "home-health": "aging-in-place", caribbean: "aging-in-place" };
export const PAGE_LABELS: Record<string, string> = { general: "Schedule a Consultation (header)", home: "Homepage", residential: "Residential Interior Design page", "design-refresh": "Design Refresh page", "model-home": "Model Home Design page", "aging-in-place": "Aging In Place page", "virtual-assessment": "Virtual Home Assessments page", commercial: "Commercial Interior Design page", "project-management": "Project Management page", "aip-partners": "AIP Partners page", hhr: "Healthy Home Resources", "aip-products": "AIP Products page", wellness: "WELLness Resources page", "home-health": "Home Health Series page", caribbean: "Caribbean Connection page", about: "About page", news: "News & Insights page", contact: "Contact page", services: "Services page" };
