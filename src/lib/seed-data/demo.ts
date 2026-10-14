/** Demo data from design/Admin.dc.html — leads, projects, bookings, Caribbean queue, etc. */
import { mediaRef as m } from "./media";

export const DEMO_USERS = [
  { email: "info@graceindesign.net", name: "Grace A. Williams", role: "owner", title: "Owner · Admin", avatar: "/assets/grace-headshot-bw.jpg" },
  { email: "emailme@clarencewilliams.com", name: "Clarence Williams", role: "owner", title: "Super admin", avatar: null },
  { email: "marcus@graceindesign.net", name: "Marcus T.", role: "sales", title: "Sales", avatar: null },
  { email: "dana@graceindesign.net", name: "Dana R.", role: "editor", title: "Editor", avatar: null },
] as const;

// Relative days keep the demo feeling "live" whenever it is seeded.
const d = (daysFromNow: number, hour = 9, minute = 0) => { const x = new Date(); x.setDate(x.getDate() + daysFromNow); x.setHours(hour, minute, 0, 0); return x; };
const iso = (daysFromNow: number) => { const x = new Date(Date.now() + daysFromNow * 864e5); return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(x); };

export type DemoLead = { name: string; email: string; phone: string; sourcePage: string; sourceLabel: string; pathId: string | null; stage: string; owner: string | null; createdDaysAgo: number; followUp: string | null; tags: string[]; answers: Record<string, string>; budget?: string; timeline?: string; activity: [string, string, number][]; booking?: { days: number; hour: number; minute: number } };
export const DEMO_LEADS: DemoLead[] = [
  { name: "Margaret Ellison", email: "m.ellison@gmail.com", phone: "(555) 201-8834", sourcePage: "aging-in-place", sourceLabel: "Aging In Place & Home Assessments", pathId: "aging-in-place", stage: "new", owner: "info@graceindesign.net", createdDaysAgo: 0, followUp: iso(0), tags: ["Homeowner", "Bathroom"], budget: "$10k–$50k", timeline: "As soon as possible", answers: { who: "A parent or relative", mobility: "Cane or walker", notes: "Mom is 82 and had a fall in the bathroom last month. Need grab bars, better lighting and ideally a walk-in shower." }, activity: [["system", "Lead created from Aging In Place page", 0], ["email", "Auto-reply sent to lead", 0]], booking: { days: 2, hour: 9, minute: 0 } },
  { name: "Northline Dental Group", email: "ops@northlinedental.com", phone: "(555) 440-7710", sourcePage: "commercial", sourceLabel: "Commercial Interior Design", pathId: "commercial", stage: "consultation_booked", owner: "marcus@graceindesign.net", createdDaysAgo: 1, followUp: iso(5), tags: ["Healthcare", "3,800 sq ft"], budget: "$50k–$150k", timeline: "1–3 months", answers: { company: "Northline Dental Group", sqft: "2,000–10,000", space_type: "Healthcare / wellness" }, activity: [["system", "Lead created from Commercial page", 1], ["email", "Intro email sent", 1], ["call", "Call with Dr. Patel — walkthrough booked", 1]], booking: { days: 4, hour: 10, minute: 0 } },
  { name: "Daniel & Priya Shah", email: "dpshah@outlook.com", phone: "(555) 318-2290", sourcePage: "residential", sourceLabel: "Residential Interior Design", pathId: "residential", stage: "proposal_sent", owner: "info@graceindesign.net", createdDaysAgo: 9, followUp: iso(1), tags: ["Kitchen", "Owner"], budget: "$50k–$150k", timeline: "1–3 months", answers: { rooms: "Kitchen", owner: "Yes" }, activity: [["system", "Lead created from Residential page", 9], ["call", "Design consult at the home", 7], ["proposal", "Proposal v2 attached — $68,400", 5]] },
  { name: "Linda Okafor, OTR/L", email: "linda@mobilityfirstot.com", phone: "(555) 772-1904", sourcePage: "aip-partners", sourceLabel: "AIP Partners", pathId: null, stage: "contacted", owner: "dana@graceindesign.net", createdDaysAgo: 6, followUp: iso(2), tags: ["Occupational therapist", "Partner"], answers: { profession: "Occupational or physical therapist", company: "Mobility First OT", notes: "Looking for a CAPS design partner for home-mod referrals." }, activity: [["system", "Lead created from AIP Partners page", 6], ["email", "Partner packet sent", 5]], booking: { days: 4, hour: 14, minute: 0 } },
  { name: "Rosa Delgado", email: "rosa.delgado@me.com", phone: "(555) 603-5521", sourcePage: "design-refresh", sourceLabel: "Design Refresh", pathId: "design-refresh", stage: "won", owner: "dana@graceindesign.net", createdDaysAgo: 14, followUp: null, tags: ["Living room", "Styling day"], budget: "Under $10k", answers: { rooms: "2–3 rooms", keep: "Mostly yes" }, activity: [["system", "Lead created from Design Refresh page", 14], ["call", "Walk-through complete", 12], ["stage", "Signed — Design Refresh package $1,850", 10]] },
  { name: "Harbor View Apartments", email: "pm@harborviewliving.com", phone: "(555) 915-3300", sourcePage: "project-management", sourceLabel: "Project Management", pathId: "project-management", stage: "new", owner: null, createdDaysAgo: 2, followUp: iso(1), tags: ["Multi-unit"], budget: "$150k+", answers: { ptype: "Commercial build-out", have: "Plans only" }, activity: [["system", "Lead created from Project Management page", 2]], booking: { days: 2, hour: 13, minute: 0 } },
  { name: "Tom Brandt", email: "tbrandt@yahoo.com", phone: "(555) 288-0412", sourcePage: "general", sourceLabel: "Start Your Project", pathId: null, stage: "nurture", owner: "info@graceindesign.net", createdDaysAgo: 22, followUp: iso(20), tags: ["Exploring"], timeline: "Just exploring", answers: { iam: "Homeowner" }, activity: [["system", "Lead created from header CTA", 22], ["email", "Added to monthly newsletter", 20]] },
  { name: "Evelyn Marsh", email: "evelyn.marsh@aol.com", phone: "(555) 149-7765", sourcePage: "aging-in-place", sourceLabel: "Aging In Place & Home Assessments", pathId: "aging-in-place", stage: "lost", owner: "marcus@graceindesign.net", createdDaysAgo: 30, followUp: null, tags: ["Moved to assisted living"], budget: "Not sure yet", answers: { who: "Myself" }, activity: [["system", "Lead created from Aging In Place page", 30], ["stage", "Marked lost — family chose assisted living", 16]] },
];

export const DEFAULT_PHASES = [
  { name: "Agreement", color: "#1a2238", stages: [["Signed agreement", "none"], ["Deposit received", "request_deposit"]] },
  { name: "Design", color: "#3f9ad9", stages: [["Discovery & measure", "none"], ["Concept & proposal", "none"], ["Client approval", "client_approval"]] },
  { name: "Build", color: "#6cb6e6", stages: [["Procurement", "none"], ["Installation / construction", "schedule_install"], ["Walk-through & punch list", "none"]] },
  { name: "Billing", color: "#7a5a00", stages: [["Final invoice", "send_invoice"], ["Payment received", "none"]] },
  { name: "Closed", color: "#1f6b3f", stages: [["Closed — review requested", "request_review"], ["Archived", "none"]] },
] as const;

export const PROJECT_FIELDS = [["contract_value", "Contract value", "currency"], ["signed_agreement", "Signed agreement (PDF)", "file"], ["site_address", "Site address", "address"], ["target_completion", "Target completion", "date"], ["project_lead", "Project lead", "user"], ["scope_summary", "Scope summary", "longtext"], ["deposit_pct", "Deposit %", "number"], ["client_portal", "Client portal access", "toggle"]] as const;

export type DemoProject = { code: string; name: string; lead: string; service: string; stage: string; value: number; owner: string; signedDaysAgo: number; targetDays: number; address: string; nextMilestone: string; status: "active" | "closed" | "archived"; invoices: [string, number, "pending" | "scheduled" | "paid"][]; milestones: [string, number, boolean][] };
export const DEMO_PROJECTS: DemoProject[] = [
  { code: "GID-2026-014", name: "Shah Residence — Kitchen", lead: "Daniel & Priya Shah", service: "Residential Interior Design", stage: "Procurement", value: 68400, owner: "info@graceindesign.net", signedDaysAgo: 4, targetDays: 95, address: "Decatur, GA", nextMilestone: "Cabinets due Nov 4", status: "active", invoices: [["Deposit (50%)", 34200, "paid"], ["Progress (30%)", 20520, "scheduled"], ["Final (20%)", 13680, "pending"]], milestones: [["Agreement signed", -4, true], ["Deposit received", -3, true], ["Design approved", 8, true], ["Cabinets delivered", 23, false], ["Install complete", 61, false]] },
  { code: "GID-2026-015", name: "Delgado — Design Refresh", lead: "Rosa Delgado", service: "Design Refresh", stage: "Walk-through & punch list", value: 1850, owner: "dana@graceindesign.net", signedDaysAgo: 10, targetDays: 8, address: "Smyrna, GA", nextMilestone: "Reveal Oct 18", status: "active", invoices: [["Full payment", 1850, "paid"]], milestones: [["Agreement signed", -10, true], ["Walk-through", -7, true], ["Styling day", 6, false]] },
  { code: "GID-2026-012", name: "Northline Dental — Suite 200", lead: "Northline Dental Group", service: "Commercial Interior Design", stage: "Concept & proposal", value: 112000, owner: "marcus@graceindesign.net", signedDaysAgo: 13, targetDays: 140, address: "Alpharetta, GA", nextMilestone: "Concept review Oct 22", status: "active", invoices: [["Deposit (20%)", 22400, "paid"], ["Design (30%)", 33600, "pending"]], milestones: [["Agreement signed", -13, true], ["Deposit received", -11, true], ["Programming complete", -2, true], ["Concept presentation", 10, false]] },
  { code: "GID-2026-011", name: "Ellison — Bathroom Safety", lead: "Margaret Ellison", service: "Aging In Place & Home Assessments", stage: "Installation / construction", value: 14900, owner: "info@graceindesign.net", signedDaysAgo: 22, targetDays: 24, address: "Marietta, GA", nextMilestone: "Grab bars Oct 28", status: "active", invoices: [["Deposit (50%)", 7450, "paid"], ["Final (50%)", 7450, "pending"]], milestones: [["Agreement signed", -22, true], ["Assessment report", -18, true], ["Materials ordered", -9, true], ["Install", 16, false]] },
  { code: "GID-2026-009", name: "Harbor View — Clubhouse PM", lead: "Harbor View Apartments", service: "Project Management", stage: "Deposit received", value: 36000, owner: "marcus@graceindesign.net", signedDaysAgo: 3, targetDays: 230, address: "Sandy Springs, GA", nextMilestone: "Kickoff Oct 24", status: "active", invoices: [["Retainer", 9000, "paid"]], milestones: [["Agreement signed", -3, true], ["Retainer received", -2, true], ["Kickoff", 12, false]] },
  { code: "GID-2026-006", name: "Brookhaven Model Home — Lot 12", lead: "Developer (placeholder)", service: "Model Home Design", stage: "Payment received", value: 48500, owner: "info@graceindesign.net", signedDaysAgo: 90, targetDays: -12, address: "Brookhaven, GA", nextMilestone: "Request review", status: "active", invoices: [["Deposit", 24250, "paid"], ["Final", 24250, "paid"]], milestones: [["Agreement signed", -90, true], ["Install", -30, true], ["Opening weekend", -22, true]] },
  { code: "GID-2026-003", name: "Okafor OT — Clinic Refresh", lead: "Linda Okafor, OTR/L", service: "Commercial Interior Design", stage: "Archived", value: 9200, owner: "dana@graceindesign.net", signedDaysAgo: 163, targetDays: -104, address: "Roswell, GA", nextMilestone: "Closed Jun 28", status: "archived", invoices: [["Full payment", 9200, "paid"]], milestones: [["Agreement signed", -163, true], ["Complete", -106, true]] },
];

export const AVAILABILITY = [
  { label: "Tue · Wed mornings", weekdays: [2, 3], startTime: "09:00", endTime: "12:00" },
  { label: "Tue · Thu afternoons", weekdays: [2, 4], startTime: "13:00", endTime: "15:00" },
  { label: "Fri early", weekdays: [5], startTime: "09:00", endTime: "10:00" },
];

export const CC_COUNTRIES = [["Jamaica", "live"], ["Regional / Diaspora", "live"], ["Trinidad & Tobago", "next"], ["Barbados", "next"], ["Bahamas", "planned"], ["Guyana", "planned"], ["Eastern Caribbean", "planned"]] as const;

export const CC_RESOURCES = [
  // status, name, category, country, area, type, kind, submitter name, email, description, days ago
  ["pending", "St. Ann Senior Care Network", "Care provider", "Jamaica", "St. Ann", "Care provider", "own", "Marcia B.", "info@stannseniorcare.org", "Home-visit companionship, meal support and transport to clinics for older adults in St. Ann.", 0],
  ["pending", "Mobility Plus Installations", "Contractor / installer", "Jamaica", "Kingston & St. Andrew", "Contractor", "own", "Devon C.", "devon@mobilityplusja.com", "Grab bars, ramps and bathroom modifications; CAPS-aligned installs.", 1],
  ["pending", "Caribbean Alzheimer's Support Group (Diaspora)", "Diaspora", "Diaspora", "Atlanta / Toronto", "Support group", "suggestion", "Submitted via site", "support@casgdiaspora.org", "Monthly virtual meetings for families caring for relatives with dementia in the Caribbean.", 3],
  ["published", "National Council for Senior Citizens (NCSC)", "Government", "Jamaica", "National", "Government agency", "curated", "GID", null, "Registration, senior citizen ID, advocacy and programmes for older Jamaicans under the Ministry of Labour and Social Security.", 41],
  ["published", "Ministry of Health & Wellness — Elderly Health", "Health", "Jamaica", "National", "Government agency", "curated", "GID", null, "Public health guidance, chronic disease programmes and health centre locations across the parishes.", 41],
  ["published", "PATH — Programme of Advancement Through Health and Education", "Financial support", "Jamaica", "National", "Government programme", "curated", "GID", null, "Conditional cash transfers that include elderly and disabled beneficiaries; how to apply and what to bring.", 41],
  ["published", "Jamaica Council for Persons with Disabilities", "Housing", "Jamaica", "National", "Government agency", "curated", "GID", null, "Accessibility standards, assistive devices and advocacy for accessible homes and public spaces.", 41],
  ["published", "HelpAge International — Caribbean", "Community", "Regional", "Caribbean", "NGO", "curated", "GID", null, "Research, advocacy and local partner programmes supporting older people across the Caribbean.", 41],
  ["published", "PAHO / WHO — Healthy Ageing in the Caribbean", "Health", "Regional", "Caribbean", "Intergovernmental", "curated", "GID", null, "Regional guidance on fall prevention, dementia care and age-friendly communities.", 41],
  ["published", "ODPEM — Office of Disaster Preparedness", "Disaster readiness", "Jamaica", "National", "Government agency", "curated", "GID", null, "Hurricane season checklists, shelter lists and preparedness guidance for households with older adults.", 41],
  ["published", "Jamaica Diaspora Affairs — Ministry of Foreign Affairs", "Diaspora", "Diaspora", "Global", "Government programme", "curated", "GID", null, "Resources for Jamaicans overseas supporting family at home, including returning-resident information.", 41],
  ["published", "Faith & community care networks (parish listings)", "Community", "Jamaica", "Parishes", "Community partners", "curated", "GID", null, "Church groups, service clubs and volunteer networks offering visits, meals and transport. Listings added as verified.", 41],
  ["rejected", "QuickCash Loans for Seniors", "Financial support", "Jamaica", "National", "Lender", "suggestion", "Anonymous", null, "Rejected: commercial lender, not a support resource.", 10],
] as const;

export type SeedEvent = readonly [status: "pending" | "published" | "rejected", title: string, where: string, format: "in_person" | "virtual", host: string, submitter: string, daysUntil: number, timeLabel: string, description: string, country: string];
/** No seeded events: every listing must be a genuine, authorized event added or approved in the admin (Caribbean Connection → Events). */
export const CC_EVENTS: readonly SeedEvent[] = [];

export const CC_SUBSCRIBERS = [
  ["p.campbell@gmail.com", "In the diaspora, supporting family back home", "Atlanta, USA", 0],
  ["ann.marie.w@yahoo.com", "Living in Jamaica", "Mandeville, Jamaica", 0],
  ["nurse.reid@manchesterhealth.gov.jm", "A caregiver or care professional", "Mandeville, Jamaica", 1],
  ["kmorgan@outlook.com", "In the diaspora, supporting family back home", "Toronto, Canada", 1],
  ["info@stannseniorcare.org", "A community organization or agency", "Ocho Rios, Jamaica", 3],
] as const;

export const RSS_SOURCES = [
  ["Grace In Design Blog", "https://graceindesign.net/blog/rss.xml", "news", null],
  ["Healthy Home Resources — Substack", "https://healthyhomeresources.substack.com/feed", "news", null],
  ["Jamaica Gleaner — Health & Seniors", "https://jamaica-gleaner.com/feed/health", "caribbean", "Jamaica"],
  ["Jamaica Observer — Health", "https://jamaicaobserver.com/feed/health", "caribbean", "Jamaica"],
  ["JIS — Social Security", "https://jis.gov.jm/feed", "caribbean", "Jamaica"],
  ["PAHO Caribbean", "https://paho.org/en/caribbean/feed", "caribbean", "Regional"],
  ["Caribbean National Weekly", "https://caribbeannationalweekly.com/feed", "caribbean", "Diaspora"],
] as const;

// slug, title, category, excerpt, image, origin, status, days ago, scope, featured, source name
// Seeded as drafts: these are topic ideas for Grace to write, not published articles. Nothing here is public until published in the admin.
export type SeedPost = readonly [slug: string, title: string, category: string, excerpt: string, image: string, origin: "written" | "rss", status: "draft" | "published", daysAgo: number, scope: "news" | "caribbean", featured: boolean, sourceName: string | null];
export const POSTS: readonly SeedPost[] = [
  ["twelve-small-changes-safer-home", "Twelve small changes that make a home safer for a lifetime", "Aging In Place", "From sensor lighting to lever handles — the low-cost upgrades our specialists recommend first, and why they matter.", m("int.lobby-bookshelf"), "written", "draft", 10, "news", true, null],
  ["kitchen-that-adds-value", "The heart of the home: planning a kitchen that adds value", "Residential", "Upgrading your kitchen improves daily function and resale value. Here's how we balance both in the design proposal.", m("int.contemporary-living"), "written", "draft", 24, "news", false, null],
  ["light-air-calm", "Light, air and calm: designing rooms that support wellbeing", "Healthy Home Resources", "What the WELL principles mean for an ordinary living room — and three changes you can make this weekend.", m("int.living-zoom"), "written", "draft", 38, "news", false, null],
  ["reception-areas", "Reception areas that say who you are before you speak", "Commercial", "Brand-forward arrival experiences for clinics and offices.", m("com.hotel-lobby"), "written", "draft", 52, "news", false, null],
  ["one-weekend-new-room", "One weekend, new room: what a refresh really changes", "Design Refresh", "Layout, light and editing — the three moves that matter most.", m("int.plants-deco"), "written", "draft", 66, "news", false, null],
  ["one-person-owns-the-plan", "Why every project needs one person who owns the plan", "Project Management", "Budgets, schedules and quality — kept together.", m("com.modern-office"), "written", "draft", 80, "news", false, null],
  ["stay-home-conversation", "Having the \"stay home\" conversation with your parents", "Aging In Place", "A gentle framework for a hard talk.", m("aip.senior-couple"), "written", "draft", 94, "news", false, null],
  ["model-homes-sell-faster", "Model homes designed to sell faster", "Model Home", "How buyer-focused merchandising shortens the path from tour to contract.", m("int.model-living-fireplace"), "written", "draft", 2, "news", false, null],
  ["long-distance-home-check", "The long-distance home check: 12 questions to ask on your next call home", "Diaspora Caregiving", "You can't see the bathroom floor from Atlanta — but you can ask about it. A practical script for spotting fall risks, lighting problems and hurricane-season gaps in a parent's home, plus what to do with the answers.", m("cc.family-dinner"), "written", "draft", 4, "caribbean", true, null],
  ["cool-bright-safe-jamaican-home", "Cool, bright and safe: Aging In Place basics for a Jamaican home", "Healthy Homes", "Cross-ventilation, glare-free lighting, slip-resistant tile and verandah thresholds — the adaptations that matter most in a tropical climate.", m("cc.verandah-sea"), "written", "draft", 18, "caribbean", false, null],
  ["hurricane-ready-home-checklist", "A hurricane-ready home for an older parent: the 10-item checklist", "Hurricane Season", "Medication lists, lighting, water, communication plans and who checks in — organized so family abroad can help from a distance.", m("cc.elderly-woman-portrait"), "written", "draft", 32, "caribbean", false, null],
];

/** No seeded regional headlines: regional news comes only from the RSS sources once they sync (Caribbean Connection → Sources). */
export const CC_REGIONAL_NEWS: readonly (readonly [title: string, source: string, daysAgo: number, image: string])[] = [];

// title, category, price, reviews, featured, image, tag, type
// Only Grace's confirmed listing is seeded, and it is seeded hidden (isActive=false in scripts/seed.ts): confirm the price and listing URL in
// Admin → Etsy products, press "Refresh from Etsy", then show it. Add further listings there by pasting their Etsy URLs.
export const PRODUCTS = [
  ["GID Home Readiness Assessment — Aging In Place Checklist (PDF)", "Assessments", "$—", "(0)", true, m("int.small-bath"), null, "Digital download"],
] as const;
export const ETSY_LISTING = "https://www.etsy.com/listing/4548113647/gid-home-readiness-assessment-aging-in";

/** No seeded testimonials: add real, approved client quotes in Admin → Content → Testimonials. */
export const TESTIMONIALS: readonly (readonly [quote: string, who: string, where: string, serviceSlug: string])[] = [];

export const TEAM = {
  name: "Grace A. Williams", title: "Principal, Grace In Design Services", credentials: "Registered Interior Designer · WELL AP · CAPS",
  quote: "I believe the best spaces are thoughtfully designed around the people who use them.",
  bio: "Grace Williams is a Registered Interior Designer and Principal of Grace In Design Services, with more than 25 years of experience in interior design, project management and the built environment. Her work spans commercial interiors, workplace, retail, healthcare and residential projects — from space planning and construction documentation to renovations, home assessments and Aging In Place design.",
  bio2: "Today she brings that experience together with a growing focus on healthy homes, accessibility, wellness and Aging In Place — helping people create spaces that support how they live now while considering how their needs may change over time.",
  education: ["Bachelor of Design — University of Florida", "M.S. Building Construction & Facilities Management — Georgia Tech"],
  credentialList: ["Registered Interior Designer — Georgia", "WELL Accredited Professional (WELL AP)", "Certified Aging-in-Place Specialist (CAPS)"],
  photo: "/assets/grace-headshot-bw.jpg",
};

export const INTEGRATIONS = [
  ["sendgrid", "Email (SendGrid)", "Lead + booking notifications, magic links", 1],
  ["twilio", "SMS (Twilio)", "Booking confirmations and reminders", 1],
  ["cft", "Call Flow Tracker", "Call events → leads, SSO sign-in, outbound events", 1],
  ["etsy", "Etsy", "Product listings", 2],
  ["rss", "RSS", "News imports", 2],
  ["magnific", "Magnific", "Generate imagery into the media library", 2],
  ["meta", "Meta (Facebook + Instagram)", "Social publishing + on-site feed", 3],
  ["linkedin", "LinkedIn", "Social publishing", 3],
  ["pinterest", "Pinterest", "Social publishing", 3],
  ["youtube", "YouTube", "Channel stats + video publishing", 3],
  ["stripe", "Stripe", "Invoices & deposits", 4],
  ["esign", "E-sign (built-in / Dropbox Sign)", "Proposal signatures", 4],
  ["hubspot", "HubSpot sync", "Contacts & deals", 4],
] as const;

export const SMS_TEMPLATES = [
  ["Booking confirmation", "Booking", "Hi {{first_name}}, you're booked for a {{consult_type}} with Grace In Design on {{when}}. Reply STOP to opt out."],
  ["24h reminder", "Booking", "Reminder: your {{consult_type}} with Grace In Design is tomorrow at {{time}}. Need to reschedule? Call (770) 691-1600."],
  ["Proposal follow-up", "Follow-up", "Hi {{first_name}}, Grace here. Did you get a chance to look over the proposal? Happy to walk through any questions."],
  ["Review request", "Close-out", "Thank you for working with Grace In Design! If you have a minute, a short review helps other families find us: {{review_link}}"],
] as const;

export const EMAIL_SEQUENCES = [
  { name: "New residential lead nurture", path: "residential", stage: "new", steps: [[24, "email", "Thanks for reaching out, {{first_name}}", "Hi {{first_name}},\n\nThank you for telling us about your home. I'll review your answers and reach out within one business day. In the meantime, here's how we work: a short consultation, a clear design plan with budget, then we manage the details so you can simply move in.\n\nWarmly,\nGrace"], [72, "email", "A quick look at what's possible", "Hi {{first_name}},\n\nMost of our residential projects start with one room — a kitchen that's cramped or a bath that's dated — and grow from there. If it helps, reply with a photo and I'll share first thoughts before we meet.\n\nGrace"], [168, "sms", null, "Hi {{first_name}}, Grace from Grace In Design. Still thinking about your project? Reply here anytime or book a time: {{booking_link}}"]] },
  { name: "Aging In Place lead nurture", path: "aging-in-place", stage: "new", steps: [[24, "email", "Your home, for a lifetime", "Hi {{first_name}},\n\nThank you for reaching out about Aging In Place. As Certified Aging-in-Place Specialists we start with a room-by-room assessment of safety, access and comfort, then recommend practical, beautiful changes. I'll be in touch within one business day.\n\nGrace"], [96, "email", "Three changes that prevent most falls", "Hi {{first_name}},\n\nSensor lighting on the path to the bathroom, a grab bar placed where a hand naturally reaches, and a lever handle instead of a knob. Small changes, big impact — and all part of a GID assessment.\n\nGrace"]] },
  { name: "Proposal sent follow-up", path: null, stage: "proposal_sent", steps: [[72, "email", "Any questions on the proposal?", "Hi {{first_name}},\n\nI wanted to check in on the proposal I sent over. Happy to walk through scope, budget or timing on a quick call.\n\nGrace"], [168, "sms", null, "Hi {{first_name}}, Grace here — checking in on the proposal. Any questions I can answer?"]] },
] as const;

export const WELLNESS_GROUPS = [
  { letter: "L", title: "Light", sub: "Daylight, circadian rhythm and glare-free task lighting", items: [["Guide", "Layered lighting for every room", "Ambient, task and accent — how much, where, and which color temperature.", m("int.armchair-window")], ["Checklist", "Night-time path lighting", "Sensor lights and lighted switches that prevent falls.", m("int.relax-sofa-window")]] },
  { letter: "A", title: "Air", sub: "Ventilation, low-VOC materials and plants that help", items: [["Guide", "Choosing low-VOC paints and finishes", "What the labels mean and the brands we specify.", m("int.plants-deco")], ["Article", "Houseplants that actually clean the air", "Low-maintenance picks for bedrooms and offices.", m("int.zoom-plants")]] },
  { letter: "M", title: "Movement", sub: "Clear paths, reachable storage and barrier-free design", items: [["Guide", "Space to maneuver: clearances that matter", "Doorways, turning radii and furniture layouts.", m("aip.kitchen-wheelchair")], ["Checklist", "Zero-step entry options", "Ramps, regrading and threshold fixes compared.", m("int.lobby-bookshelf")]] },
  { letter: "W", title: "Water & Comfort", sub: "Bathrooms, flooring and the details that keep you safe", items: [["Guide", "Grab bars that look like they belong", "Placement, load ratings and finishes that match your fixtures.", m("aip.shower-grab-bar")], ["Article", "Slip-resistant flooring, room by room", "Ratings explained and our favorite materials.", m("int.small-bath")]] },
];

export const EPISODES = [
  { num: "08", room: "Bathroom", title: "The bathroom: five changes before a fall, not after", desc: "Grab bars, lighting, flooring, faucets and the step-in — what to change first and what it costs.", len: "9 min", img: m("brand.couple-sunset"), featured: true, date: 11 },
  { num: "07", room: "Kitchen", title: "Reachable storage without a remodel", desc: "Pull-downs, drawers and counters at more than one height.", len: "7 min", img: m("aip.kitchen-wheelchair"), featured: false, date: 25 },
  { num: "06", room: "Entry", title: "Zero-step entry: three ways in", desc: "Ramps, regrading and the threshold fix most people miss.", len: "8 min", img: m("int.lobby-bookshelf"), featured: false, date: 39 },
  { num: "05", room: "Bedroom", title: "Light that helps you sleep", desc: "Blackout, warm dimming and a lit path to the bathroom.", len: "6 min", img: m("int.relax-sofa-window"), featured: false, date: 53 },
  { num: "04", room: "Living room", title: "Furniture layouts with room to move", desc: "Clearances, firm seating and rugs that don't trip.", len: "9 min", img: m("int.contemporary-living"), featured: false, date: 67 },
  { num: "03", room: "Whole home", title: "Lever handles and lighted switches", desc: "Small hardware swaps with big daily impact.", len: "5 min", img: m("int.armchair-window"), featured: false, date: 81 },
  { num: "02", room: "Mind", title: "Clutter, calm and the WELL mind concept", desc: "Why what you see every day shapes how you feel.", len: "8 min", img: m("int.minimal-green-art"), featured: false, date: 95 },
];

export const SOCIAL_DEMO = {
  networks: [["facebook", "Facebook", 860, "connected"], ["instagram", "Instagram", 1240, "connected"], ["linkedin", "LinkedIn", 512, "connected"], ["pinterest", "Pinterest", 2030, "disconnected"], ["youtube", "YouTube", 140, "disconnected"]] as const,
  posts: [
    ["Before/after: kitchen reveal", ["instagram"], -1, 9, "published"],
    ["Why model homes sell communities", ["linkedin"], 0, 11, "scheduled"],
    ["New post: Twelve small changes that make a home safer for a lifetime", ["facebook"], 2, 10, "scheduled"],
    ["Pin: bathroom safety planner", ["pinterest"], 2, 10, "scheduled"],
    ["Grace on WELL concepts (reel)", ["instagram"], 3, 12, "draft"],
  ] as const,
};

export const dates = { d, iso };
