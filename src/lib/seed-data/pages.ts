/** Page + block seeds. Copy is verbatim from the design/*.dc.html prototypes. */
import { mediaRef as m } from "./media";
import { shelfSection } from "../shelves";

export type SeedBlock = { type: string; content: Record<string, unknown> };
export type SeedPage = { key: string; slug: string; title: string; navLabel: string; heroStyle?: "classic" | "cinematic"; seoTitle?: string; seoDescription?: string; parentKey?: string; sort: number; status?: "draft" | "published"; blocks: SeedBlock[] };

export const PAGES: SeedPage[] = [
  {
    key: "home", slug: "/", title: "Homepage", navLabel: "Certified Aging-in-Place Specialists", heroStyle: "cinematic", sort: 0,
    seoTitle: "Grace In Design · Interior design, Aging In Place and project management in Atlanta", seoDescription: "Atlanta interior design studio for residential and commercial spaces, Certified Aging-in-Place home assessments and owner-side project management.",
    blocks: [
      { type: "hero", content: {
        kicker: "Residential · Commercial · Aging In Place", lead: "You deserve", tail: "that works as beautifully as you do.", cta: "Book a Free 15-Minute Call", ctaHref: "/contact?from=home", secondary: "See how it works", secondaryHref: "/services", scenesLabel: "What we design", slideSeconds: 5,
        scenes: [
          { name: "Residential", word: "a home", line: "Kitchens, baths, bedrooms and living rooms designed around your goals, budget and style.", img: m("int.kitchen-windows"), href: "/services/residential" },
          { name: "Commercial", word: "a workplace", line: "Offices, clinics and hospitality spaces that reflect your brand and support your team.", img: m("com.open-office"), href: "/services/commercial" },
          { name: "Aging In Place", word: "a lifetime home", line: "Certified specialists who make your house safe, accessible and beautiful for decades.", img: m("brand.couple-sunset"), href: "/services/aging-in-place" },
          { name: "Design Refresh", word: "a fresh start", line: "A new look in days — re-planning, color, lighting and styling with what you already own.", img: m("int.plants-deco"), href: "/services/residential/design-refresh" },
        ],
        classic: { title: "You deserve a space that works as beautifully as you do.", sub: "Whether you're renovating a home, refreshing an office, or planning to live independently for decades to come — Grace In Design guides you from first sketch to final walk-through, within your budget and your style.", img: m("com.lounge-office"), stats: [["CAPS", "Certified Aging-in-Place Specialists"], ["6-Step", "Clear process, no surprises"], ["On Budget", "Your goals set the scope"]], badgeTitle: "Plan it. Build it. Love it.", badgeSub: "Your guide for every phase of the project" },
      } },
      { type: "steps", content: { items: [["Tell us about your space", "A short form — we'll reach out within one business day."], ["Get a clear design plan", "Scope, concepts and budget presented for your approval."], ["Enjoy a space made for life", "We manage the details so you can simply move in."]] } },
      { type: "services_grid", content: {
        eyebrow: "Our Services", title: "Design for the way you live and work — today and for years to come.", intro: "Our number one priority is your design goal. We work within your budget and incorporate your style to create spaces you'll love being in.",
        cards: [
          { kicker: "Residential", title: "Residential Interior Design", blurb: "Kitchens, baths, bedrooms and living rooms designed around your goals, your budget and your style — spaces you'll love for years to come.", img: m("int.bright-apartment"), href: "/services/residential" },
          { kicker: "Aging In Place", title: "Aging In Place & Home Assessments", blurb: "Our Certified Aging-in-Place Specialists evaluate your home and recommend modifications so you can live independently, safely and comfortably.", img: m("brand.couple-autumn"), href: "/services/aging-in-place" },
          { kicker: "Healthy Home Resources", title: "AIP Partners", blurb: "A vetted network of contractors, occupational therapists and installers who share our commitment to livable, lifetime homes.", img: m("brand.aip-planning"), href: "/healthy-home-resources/aip-partners" },
          { kicker: "Commercial", title: "Commercial Interior Design", blurb: "Offices, clinics and hospitality spaces that reflect your brand, support your people and welcome every client who walks in.", img: m("brand.com-meeting"), href: "/services/commercial" },
          { kicker: "Residential · Refresh", title: "Design Refresh", blurb: "Give your home a new look without a full renovation — space re-planning, color, lighting and styling with the pieces you already own.", img: m("int.plants-deco"), href: "/services/residential/design-refresh" },
          { kicker: "Build", title: "Project Management", blurb: "Owner-side planning, budgeting, scheduling and coordination from start to finish — one point of contact who keeps you informed.", img: m("brand.pm-site-1"), href: "/services/project-management" },
          { kicker: "Residential · Builders", title: "Model Home Design", blurb: "Model home merchandising for builders and developers — furnishings, finishes and styling that help buyers picture their life and sell the community faster.", img: m("int.model-living-fireplace"), href: "/services/residential/model-home" },
        ],
      } },
      { type: "why_band", content: { founderName: "Grace A. Williams · Principal", founderCreds: "Registered Interior Designer · WELL AP · CAPS", founderPhoto: m("brand.grace-bw"), eyebrow: "Why Grace In Design", title: "We know how overwhelming a renovation can feel. That's why you won't do it alone.", body: "From initial consultation through final review, one guide leads your project — evaluating your immediate needs and those of future generations, so the home you love stays the home you can live in.", cta: "Start Your Project", ctaHref: "/contact?from=home", cards: [["Initial Consultation", "We listen, measure, and understand your goals."], ["Design Proposal", "Scope, concepts and budget — approved by you."], ["Implementation", "Materials ordered, contractors coordinated."], ["Final Review", "A walk-through together until you're delighted."]] } },
      { type: "featured_products", content: { eyebrow: "Healthy Home Resources · Featured", title: "Tools and resources for a home that cares for you", linkLabel: "Browse AIP Products", linkHref: "/healthy-home-resources/aip-products", count: 4 } },
      { type: "news", content: { eyebrow: "News & Insights", title: "Ideas for living well at home", linkLabel: "All articles", linkHref: "/news", count: 3 } },
      { type: "cta", content: { title: "Ready to make your house a home for a lifetime?", body: "Tell us a little about your project. We'll follow up within one business day with next steps — no obligation.", cta: "Get Started", ctaHref: "/contact?from=home" } },
    ],
  },
  {
    key: "about", slug: "/about", title: "About", navLabel: "About Grace In Design", heroStyle: "classic", sort: 1, seoDescription: "Meet Grace A. Williams, Registered Interior Designer, WELL AP and Certified Aging-in-Place Specialist, and the Atlanta studio she founded in 2008.",
    blocks: [
      { type: "about_hero", content: { eyebrow: "Grace In Design", title: "Design that honors how you live — now and for a lifetime.", body: "Founded in 2008, Grace In Design Services, LLC is an Atlanta-based interior design and project management firm focused on creating thoughtful spaces that support how people live, work and age.", chips: ["Registered Interior Designer — Georgia", "WELL AP", "Certified Aging-in-Place Specialist (CAPS)"], img: m("brand.studio-team") } },
      { type: "about_intro", content: { eyebrow: "About Grace In Design", title: "Spaces that work better for the people who use them.", p1: "GID provides Interior Design, Aging In Place, Healthy Home Resources and Project Management services for residential and commercial clients. Our approach combines practical design expertise with a focus on wellness, accessibility, functionality and long-term livability.", p2: "From commercial interiors and renovation projects to home assessments and Aging In Place planning, our goal is simple: create spaces that work better for the people who use them.", areas: [["Interior Design", "Residential & Commercial"], ["Aging In Place", "Home assessments"], ["Healthy Home Resources", "WELLness focused resources"], ["Project Management", "Planning through delivery"]] } },
      { type: "founder", content: { eyebrow: "Meet the founder", cta: "Schedule a Consultation", ctaHref: "/contact?from=about" } },
    ],
  },
  {
    key: "services", slug: "/services", title: "Services", navLabel: "Our Services", heroStyle: "cinematic", sort: 2, seoDescription: "Residential and commercial interior design, Aging In Place home assessments, design refresh, model home design and project management in Atlanta.",
    blocks: [
      { type: "cine_hero", content: { kicker: "Our Services", lead: "Design for", tail: "— today and for years to come.", scenesLabel: "How we help", cta: "Start a Project", ctaHref: "/contact?from=services", hoverSelects: true, scenes: [
        { name: "Residential", word: "the home you love", line: "Kitchens, baths, bedrooms and living rooms designed around your goals, budget and style.", img: m("int.kitchen-windows"), href: "/services/residential" },
        { name: "Aging In Place", word: "a lifetime at home", line: "Certified specialists who make your house safe, accessible and beautiful for decades.", img: m("aip.shower-grab-bar"), href: "/services/aging-in-place" },
        { name: "Commercial", word: "the way you work", line: "Offices, clinics and hospitality spaces that reflect your brand and support your team.", img: m("com.open-office"), href: "/services/commercial" },
        { name: "Design Refresh", word: "a fresh start", line: "A new look in days — space re-planning, color, lighting and styling with what you own.", img: m("int.plants-deco"), href: "/services/residential/design-refresh" },
      ] } },
      { type: "service_list", content: {} },
    ],
  },
  {
    key: "hhr", slug: "/healthy-home-resources", title: "Healthy Home Resources", navLabel: "Healthy Home Resources", heroStyle: "cinematic", sort: 3, seoDescription: "Products, guides, videos and partners for a healthier, safer, more accessible home, from Certified Aging-in-Place Specialists.",
    blocks: [
      { type: "cine_hero", content: { kicker: "Healthy Home Resources", lead: "A home built for", tail: "— every room, every stage of life.", scenesLabel: "WELL concepts we design around", cta: "Request an Assessment", ctaHref: "/contact?from=aging-in-place", scenes: [
        { name: "Light", word: "light", line: "Daylight, warm evening dimming and lit paths — lighting that supports sleep and prevents falls.", img: m("int.armchair-window") },
        { name: "Air", word: "clean air", line: "Low-VOC finishes, ventilation and plants that genuinely help.", img: m("int.zoom-plants") },
        { name: "Movement", word: "movement", line: "Clear paths, reachable storage and barrier-free design for every body.", img: m("brand.couple-autumn") },
        { name: "Mind", word: "calm", line: "Uncluttered, restorative rooms that lower stress the moment you walk in.", img: m("int.minimal-green-art") },
      ] } },
      { type: "hhr_cards", content: { cards: [
        { kicker: "Shop", title: "AIP Products", body: "Home-safety essentials our specialists recommend, with links to buy on Amazon.", cta: "Browse products", href: "/healthy-home-resources/aip-products", img: m("aip.shower-grab-bar") },
        { kicker: "Learn", title: "WELLness Resources", body: "Guides and downloads on light, air, water and materials for a healthier home.", cta: "Explore resources", href: "/healthy-home-resources/wellness", img: m("int.minimal-green-art") },
        { kicker: "Watch & read", title: "Home Health Series", body: "Short episodes on the small changes that make a home safer and calmer.", cta: "Start the series", href: "/healthy-home-resources/home-health-series", img: m("brand.couple-hammock") },
        { kicker: "Partner", title: "AIP Partners", body: "Contractors, therapists and realtors — join our Aging In Place network.", cta: "Become a partner", href: "/healthy-home-resources/aip-partners", img: m("brand.aip-planning") },
      ] } },
      { type: "assessment_cta", content: { title: "Not sure where to start? Begin with a home assessment.", body: "A room-by-room review of safety, access and comfort — the foundation of every Healthy Home Resources plan.", cta: "Request an Assessment", ctaHref: "/contact?from=aging-in-place" } },
      // WELLness-Products: the catalog listings ticked for the "wellness" shelf in Admin → Products. The same block can be added to any other page from Content → Pages → Add block.
      { type: "product_shelf", content: shelfSection("wellness") },
    ],
  },
  {
    key: "aip-products", slug: "/healthy-home-resources/aip-products", title: "AIP Products", navLabel: "Healthy Home Resources · AIP Products", parentKey: "hhr", sort: 4, seoDescription: "Home-safety and Aging In Place products recommended by Grace In Design's Certified Aging-in-Place Specialists, with links to buy on Amazon.",
    blocks: [
      { type: "page_header", content: { crumb: "Healthy Home Resources · AIP Products", crumbHref: "/healthy-home-resources", title: "Aging In Place essentials, curated by our specialists", body: "Products we recommend to the families we work with, chosen by our Certified Aging-in-Place Specialists. Each one links to the store that sells it, where checkout and delivery are handled securely.", badge: "Available on Amazon", badgeDot: "#ff9900", badgeCount: "products" } },
      // `shelf: "aip"`: the listings ticked for the AIP Products page in Admin → Products (src/lib/shelves.ts).
      { type: "product_carousel", content: { eyebrow: "Featured this month", title: "Specialist picks", shelf: "aip" } },
      // Filters come from the products' own categories; `categories` only fixes their order. `disclosure` prints under the grid (e.g. an affiliate note).
      { type: "product_grid", content: { title: "All products", shelf: "aip", categories: [], disclosure: "" } },
    ],
  },
  {
    key: "wellness", slug: "/healthy-home-resources/wellness", title: "WELLness Resources", navLabel: "Healthy Home Resources · WELLness Resources", parentKey: "hhr", sort: 5, seoDescription: "Guides on light, air, movement and water organized by the WELL concepts Grace In Design designs around, plus a free healthy-home checklist.",
    blocks: [
      { type: "page_header", content: { crumb: "Healthy Home Resources · WELLness Resources", crumbHref: "/healthy-home-resources", title: "Design choices that support your health — explained simply", body: "Guides organized by the WELL concepts we design around. Download, share with family, or bring to your consultation." } },
      { type: "guide_carousel", content: { eyebrow: "Start here", title: "Most-downloaded guides" } },
      { type: "wellness_groups", content: { leadMagnet: { eyebrow: "Free download", title: "The 10-Minute Healthy Home Walk-Through", body: "Our quick checklist for light, air, water and safety — the same one our specialists start with.", cta: "Send me the checklist", link: "Or request a full home assessment →", linkHref: "/contact?from=aging-in-place" } } },
    ],
  },
  {
    key: "home-health", slug: "/healthy-home-resources/home-health-series", title: "Home Health Series", navLabel: "Healthy Home Resources · Home Health Series", parentKey: "hhr", sort: 6, seoDescription: "Short episodes on the small changes that make a home safer and calmer, one room or habit at a time.",
    blocks: [
      { type: "page_header", content: { crumb: "Healthy Home Resources · Home Health Series", crumbHref: "/healthy-home-resources", title: "Short episodes on living well at home", body: "Each episode tackles one room or one habit. Watch in under ten minutes, then use the companion notes to act on it." } },
      { type: "featured_episode", content: {} },
      { type: "episode_carousel", content: { eyebrow: "All episodes", title: "Browse the series" } },
    ],
  },
  {
    key: "caribbean", slug: "/caribbean-connection", title: "Caribbean Connection", navLabel: "Caribbean Connection", heroStyle: "cinematic", sort: 7, seoDescription: "Resources for older adults, families and caregivers across Jamaica and the Caribbean.",
    blocks: [
      { type: "cine_hero", content: { kicker: "Caribbean Connection", lead: "Healthy Homes. Aging In Place.", tail: "", wordOnly: true, scenesLabel: "What you'll find here", sub: "Practical information, regional news and resources to support older adults, families, caregivers and communities throughout Jamaica and the Caribbean.", cta: "Get the Caribbean Newsletter", ctaHref: "#newsletter", secondary: "Supporting family back home? Talk to us", secondaryHref: "/contact?from=caribbean", scenes: [
        { name: "Caribbean Blog", word: "Connected Communities.", line: "", img: m("cc.family-dinner"), href: "#blog" },
        { name: "Caribbean Newsletter", word: "Stay informed.", line: "", img: m("cc.senior-couple-hug"), href: "#newsletter" },
        { name: "Resource Directory", word: "Find help nearby.", line: "", img: m("cc.seniors-walking"), href: "#directory" },
        { name: "Community Events", word: "Come together.", line: "", img: m("cc.seniors-beach"), href: "#events" },
      ] } },
      { type: "cc_why", content: { eyebrow: "Why this exists", title: "Caring for a parent in Jamaica from Atlanta, London or Toronto shouldn't mean guessing.", body: "Thousands of Jamaicans living overseas are supporting parents and relatives back home — arranging care, paying for repairs, worrying about falls and hurricanes from a distance. Caribbean Connection gathers what you need in one place: trusted regional news, agencies and programs, upcoming events, and GID's own guidance on healthy, accessible homes adapted for Caribbean living.", calloutBold: "Launching with Jamaica as our foundation.", callout: "We'll add other Caribbean countries as we develop reliable sources and relationships on the ground." } },
      { type: "cc_pillars", content: { pillars: [
        { kicker: "Read", title: "Caribbean Blog", desc: "GID articles on healthy, accessible homes for Caribbean living, alongside curated regional news.", cta: "Read the latest", href: "#blog", img: m("cc.family-dinner") },
        { kicker: "Subscribe", title: "Caribbean Newsletter", desc: "Periodic highlights delivered by email — articles, news, new resources and events.", cta: "Subscribe", href: "#newsletter", img: m("cc.senior-couple-hug") },
        { kicker: "Find", title: "Resource Directory", desc: "Agencies, programs and community partners — starting with Jamaica.", cta: "Browse the directory", href: "#directory", img: m("cc.seniors-walking") },
        { kicker: "Attend", title: "Community Events", desc: "Fairs, workshops and educational opportunities at home and in the diaspora.", cta: "See upcoming events", href: "#events", img: m("cc.seniors-beach") },
      ] } },
      { type: "cc_blog", content: { eyebrow: "Caribbean Blog", title: "GID articles and curated regional news", badge: "GID posts + regional RSS sources · curated by Grace", regionalLabel: "Regional news · Jamaica", regionalNote: "Sources are curated by Grace In Design and added as relationships develop. Headlines link to the original publisher." } },
      { type: "cc_directory", content: { eyebrow: "Resource Directory", title: "Agencies, programs and community partners", categories: ["All", "Government", "Health", "Housing", "Community", "Diaspora", "Disaster readiness", "Financial support"], formEyebrow: "Add to the directory", formTitle: "Suggest a resource — or list your organization", formBody: "Agencies, programs, care providers, contractors and community partners serving older adults in Jamaica and the Caribbean. Every submission is reviewed by Grace In Design before it appears here.", bullets: ["Takes about two minutes", "Reviewed within 5 business days", "You'll get an email when it's published"] } },
      { type: "cc_events", content: { eyebrow: "Community Events", title: "Fairs, workshops and educational opportunities", body: "In Jamaica and in diaspora communities — Atlanta, South Florida, New York, Toronto and London. Virtual sessions are marked so family overseas can join.", formEyebrow: "Submit an event", formBody: "Fairs, workshops, clinics and talks for older adults, families and caregivers. Reviewed before listing." } },
      { type: "cc_newsletter", content: { eyebrow: "Caribbean Newsletter", title: "Periodic highlights delivered by email", body: "New GID articles, the regional stories that matter for older adults and caregivers, directory additions and upcoming events — a short read every few weeks. Especially useful if you're supporting family in Jamaica from abroad.", bullets: ["Every 3–4 weeks", "Unsubscribe anytime", "Jamaica first · region to follow"] } },
    ],
  },
  {
    key: "news", slug: "/news", title: "News & Insights", navLabel: "News & Insights", sort: 8, seoDescription: "Articles and curated reads from Grace In Design on healthy, accessible, well-designed homes and workplaces.",
    blocks: [
      { type: "page_header", content: { eyebrow: "News & Insights", title: "Ideas for living well at home", badge: "Articles and curated reads", badgeRss: true, compact: true } },
      { type: "news_grid", content: { count: 6 } },
    ],
  },
  {
    key: "contact", slug: "/contact", title: "Schedule a Consultation", navLabel: "Schedule a Consultation", sort: 9, status: "published", seoDescription: "Book a free 15-minute call with Grace In Design about your home, workplace or Aging In Place project in Atlanta.",
    blocks: [
      { type: "contact_header", content: { eyebrow: "Let's talk", title: "Fifteen minutes to understand your space — and what to do next.", body: "One form for every kind of project. Answer a few questions, pick a time, and Grace will call you — free, no obligation." } },
      { type: "consult_form", content: {} },
      { type: "contact_steps", content: { items: [["We listen first", "Your goals, your budget, your timeline — before we suggest anything."], ["You get a clear next step", "A consultation, an assessment, or honest advice that it isn't the right fit yet."], ["Prefer to reach out directly?", "(770) 691-1600 · support@graceindesign.net · Mon–Fri 9–5 ET"]] } },
    ],
  },
  { key: "privacy", slug: "/privacy", title: "Privacy Policy", navLabel: "Privacy Policy", sort: 20, seoDescription: "How Grace In Design Services, LLC collects, uses and protects the information you share.", blocks: [{ type: "rich_text", content: { title: "Privacy Policy", body: "<p>Grace In Design Services, LLC respects your privacy. We collect the information you share through our consultation and contact forms (name, email, phone, project details) solely to respond to your request and provide our services. We do not sell your information. You can ask us to update or delete your information at any time by emailing support@graceindesign.net.</p><p>Text messages: by providing your phone number and consenting on our form, you agree to receive appointment confirmations and reminders. Reply STOP to opt out at any time.</p>" } }] },
  { key: "terms", slug: "/terms", title: "Terms", navLabel: "Terms", sort: 21, seoDescription: "Terms of use for the Grace In Design website.", blocks: [{ type: "rich_text", content: { title: "Terms of Use", body: "<p>This website is provided by Grace In Design Services, LLC for informational purposes. Design services are provided under a separate written agreement. Product listings link to our Etsy shop, where Etsy's terms apply. Resource directory and event listings in Caribbean Connection are reviewed before publication but provided without warranty — please verify details directly with each organization.</p>" } }] },
  { key: "accessibility", slug: "/accessibility", title: "Accessibility", navLabel: "Accessibility", sort: 22, seoDescription: "Our commitment to an accessible website and how to tell us about any barrier you encounter.", blocks: [{ type: "rich_text", content: { title: "Accessibility Statement", body: "<p>Accessibility is at the heart of our work and this website. We aim to meet WCAG 2.1 AA: keyboard-navigable menus and forms, sufficient color contrast, reduced-motion support for animated heroes, and descriptive text for images. If you encounter a barrier, please tell us at support@graceindesign.net or (770) 691-1600 and we will fix it.</p>" } }] },
];
