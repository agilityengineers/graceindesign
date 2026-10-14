/**
 * Launch content patch — applies the October 2026 pre-launch review to an ALREADY-SEEDED database without wiping it.
 *
 *   npm run content:launch -- --dry-run      # print every change, write nothing
 *   npm run content:launch                   # apply the content corrections
 *   npm run content:launch -- --ops          # also remove demo operations data (sample team accounts, leads, projects,
 *                                            #   proposals, portals, social accounts, newsletter subscribers)
 *   npm run content:launch -- --self-test    # check the text rules without a database
 *
 * Run it once against the workspace (dev) database and once with DATABASE_URL pointed at production.
 * It is safe to run repeatedly:
 *   - text updates apply only where the current value still equals the prototype value, so edits made in the admin survive;
 *   - deletions only match rows the prototype seed created (by their seeded titles, slugs, emails, codes or tokens).
 * The seed files under src/lib/seed-data carry the same corrections, so a fresh `npm run db:seed` needs no patch.
 */
import "dotenv/config";
import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import * as S from "../src/lib/db/schema";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const OPS = args.includes("--ops");
const SELF_TEST = args.includes("--self-test");

// --------------------------------------------------------------------------------------------------------------------
// Text rules
// --------------------------------------------------------------------------------------------------------------------
type Rules = { exact?: Record<string, string>; sub?: [string, string][]; casing?: boolean };

/** Brand rule from the review: prose says "Aging In Place"; the credential stays "Certified Aging-in-Place Specialist (CAPS)". URLs, slugs and media refs are never touched. */
export function fixCasing(s: string): string {
  if (/^(\/|#|https?:|media:\/\/|mailto:|tel:)/.test(s) || /^[a-z0-9-]+$/.test(s)) return s;
  let out = s.replace(/Certified Aging[- ][Ii]n[- ][Pp]lace Specialist/g, "Certified Aging-in-Place Specialist");
  out = out.replace(/(?<!Certified )(?<![\w/=:-])[Aa]ging[- ][Ii]n[- ][Pp]lace(?![\w/-])/g, "Aging In Place");
  return out;
}
function fixString(v: string, r: Rules): string {
  let out = v;
  if (r.exact && Object.prototype.hasOwnProperty.call(r.exact, out)) out = r.exact[out];
  if (r.sub) for (const [a, b] of r.sub) out = out.split(a).join(b);
  if (r.casing) out = fixCasing(out);
  return out;
}
function fixDeep<T>(v: T, r: Rules): T {
  if (typeof v === "string") return fixString(v, r) as T;
  if (Array.isArray(v)) return v.map((x) => fixDeep(x, r)) as T;
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = fixDeep(x, r); return o as T; }
  return v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const PLACEHOLDER_BODY = "<p>This article is a placeholder seeded from the prototype. Edit it under Content → News & Insights.</p>";

const SERVICE_RULES: Record<string, { all?: Rules; cols?: Partial<Record<"plan" | "features" | "success" | "scenes", Rules>> }> = {
  general: { all: { exact: { "We've guided hundreds of homeowners and businesses through that same uncertainty.": "We've guided homeowners and businesses through that same uncertainty." } } },
  "model-home": { all: { sub: [["With 20+ years of experience, GID helps developers", "With more than 25 years of design and construction experience behind the studio, GID helps developers"], ["20+ years of experience · Buyer-focused", "25+ years of experience · Buyer-focused"]] } },
  "aging-in-place": { all: { exact: {
    "Certified Aging-in-Place Specialists (CAPS). Hundreds of home assessments completed.": "Certified Aging-in-Place Specialists (CAPS). Room-by-room home assessments with clear, prioritized recommendations.",
    "We enhance your home": "We coordinate the work",
    "We install assistive devices and manage the necessary modifications.": "We prepare design recommendations and specifications, then coordinate with qualified contractors who carry out the modifications.",
    "Ramp installation, zero-step entry, clear walkways, space to maneuver.": "Ramps, zero-step entries, clear walkways and room to maneuver.",
  } } },
  commercial: { cols: { scenes: { exact: { "Open office": "Workspace", "open office": "workspace" } } } },
  "project-management": {
    all: { exact: {
      "Your project — on time, within budget, to the standard you expect.": "Your project, with one person keeping plan, budget and schedule in view.",
      "We plan, organize and control every resource and activity from start to finish: budgeting, scheduling and coordinating contractors and professionals.": "Owner-side project management for residential and commercial work. We help you set scope and budget targets, build the schedule, coordinate contractors and consultants, and keep you informed at every step.",
      "Construction project management across residential and commercial builds.": "Project management and coordination for residential and commercial projects, from planning through close-out.",
      "Delays and overruns become your problem to solve.": "Without an owner's advocate, delays and overruns land on your desk.",
      "to done — on time and on budget.": "to done — with one guide the whole way.",
    } },
    cols: {
      plan: { exact: { "Scope, budget, timeline and a risk-management plan.": "Scope, budget targets, timeline and the risks to watch.", "Scheduling & resources": "Scheduling & coordination", "Tasks, milestones, materials, equipment and labor allocated.": "Milestones, trades and deliveries coordinated so decisions happen on time.", "Quality control": "Monitoring & communication", "Issues identified and addressed promptly, through completion.": "Progress tracked against the plan, issues raised early, regular updates to you." } },
      success: { exact: { "Clear plan, clear budget": "A clear plan and budget targets", "One point of accountability": "One point of contact", "Quality you can see": "Decisions made with full information" } },
      features: { exact: { "Scope, budget, timeline, risk.": "Scope, budget targets, timeline, risk.", "Budgeting": "Budget tracking", "Set with you — and held.": "Costs monitored against targets and reported to you.", "Quality control": "Quality monitoring", "Specified standards, verified.": "Work checked against the specifications; issues flagged for correction." } },
      scenes: { exact: { "Contractors, trades and deliveries scheduled so the work never waits.": "Contractors, trades and deliveries coordinated so decisions happen on time.", "Specified standards, verified on site, issues resolved promptly.": "Work checked against the specifications, issues flagged for correction.", "On time, within budget, to the standard you expect.": "Progress tracked against the plan, issues raised early, and you kept informed." } },
    },
  },
};

const PAGE_BLOCK_RULES: Record<string, Rules> = {
  home: { exact: {
    "Get Started — It's Free": "Book a Free 15-Minute Call",
    "Planning, budgeting, scheduling and quality control from start to finish — on time, within budget and to the standard you expect.": "Owner-side planning, budgeting, scheduling and coordination from start to finish — one point of contact who keeps you informed.",
  } },
  "aip-products": { exact: {
    "Aging-in-place essentials, curated by our specialists": "Aging In Place essentials, curated by our specialists",
    "Every product links to our Etsy shop. Admins add new listings from the dashboard — paste the Etsy link and it appears here.": "Every product links to our Etsy shop, where checkout and delivery are handled securely.",
  } },
  news: { exact: { "Synced from RSS · updated hourly": "Articles and curated reads" } },
};

/** New meta descriptions. Applied when the page has none, or still has the prototype's one-liner. */
const PAGE_SEO: Record<string, { description: string; replaces?: string[]; title?: { from: string; to: string } }> = {
  home: { description: "Atlanta interior design studio for residential and commercial spaces, Certified Aging-in-Place home assessments and owner-side project management.", replaces: ["Interior design, aging-in-place and project management in Atlanta."], title: { from: "Grace In Design · Interior design, aging-in-place and project management in Atlanta", to: "Grace In Design · Interior design, Aging In Place and project management in Atlanta" } },
  about: { description: "Meet Grace A. Williams, Registered Interior Designer, WELL AP and Certified Aging-in-Place Specialist, and the Atlanta studio she founded in 2008.", replaces: ["About Grace In Design Services."] },
  services: { description: "Residential and commercial interior design, Aging In Place home assessments, design refresh, model home design and project management in Atlanta.", replaces: ["Our services."] },
  hhr: { description: "Products, guides, videos and partners for a healthier, safer, more accessible home, from Certified Aging-in-Place Specialists." },
  "aip-products": { description: "Aging In Place checklists, planners and home-safety essentials from the Grace In Design Etsy shop." },
  wellness: { description: "Guides on light, air, movement and water organized by the WELL concepts Grace In Design designs around, plus a free healthy-home checklist." },
  "home-health": { description: "Short episodes on the small changes that make a home safer and calmer, one room or habit at a time." },
  news: { description: "Articles and curated reads from Grace In Design on healthy, accessible, well-designed homes and workplaces." },
  contact: { description: "Book a free 15-minute call with Grace In Design about your home, workplace or Aging In Place project in Atlanta." },
  privacy: { description: "How Grace In Design Services, LLC collects, uses and protects the information you share." },
  terms: { description: "Terms of use for the Grace In Design website." },
  accessibility: { description: "Our commitment to an accessible website and how to tell us about any barrier you encounter." },
};

// Rows the prototype seed invented. Matched by their seeded identifiers only.
const FAKE_PRODUCT_TITLES = ["Bathroom Safety Planner: Grab Bars, Lighting & Flooring", "WELLness Room-by-Room Workbook", "Lifetime Home Essentials Starter Kit", "Accessible Kitchen Planning Guide", "Family Conversation Kit: Planning to Stay Home", "Lighting for Aging Eyes — Room-by-Room Plan", "Entryway Safety Kit: Lever Handles & Sensor Lighting"];
const REAL_PRODUCT_SEED_TITLE = "GID Home Readiness Assessment — Aging-in-Place Checklist (PDF)";
const FAKE_EVENT_TITLES = ["Healthy Homes for Our Elders — Community Fair", "Caring from Abroad: a workshop for diaspora families", "Hurricane-Season Wrap-Up & Winter Readiness", "Bathroom Safety Clinic — Atlanta Jamaican Association", "Home Health Series Live: Light, air and calm in a Caribbean home", "Fall-Prevention Workshop for Seniors", "Caring for Parents Abroad — Q&A", "Timeshare Presentation & Lunch"];
const SEED_POST_SLUGS = ["twelve-small-changes-safer-home", "kitchen-that-adds-value", "light-air-calm", "reception-areas", "one-weekend-new-room", "one-person-owns-the-plan", "stay-home-conversation", "model-homes-sell-faster", "long-distance-home-check", "cool-bright-safe-jamaican-home", "hurricane-ready-home-checklist"];
const FAKE_TESTIMONIAL_QUOTES = ["Grace made our mom's bathroom safe without making it look like a hospital. She can shower on her own again.", "Our model sold the community. Buyers walked in and could see themselves living there.", "One guide from first sketch to final walk-through. No surprises, on budget."];
const FAKE_RESOURCE_NAMES = ["St. Ann Senior Care Network", "Mobility Plus Installations", "Caribbean Alzheimer's Support Group (Diaspora)", "QuickCash Loans for Seniors"];
// --ops only
const DEMO_TEAM_EMAILS = ["marcus@graceindesign.net", "dana@graceindesign.net"];
const DEMO_LEAD_EMAILS = ["m.ellison@gmail.com", "ops@northlinedental.com", "dpshah@outlook.com", "linda@mobilityfirstot.com", "rosa.delgado@me.com", "pm@harborviewliving.com", "tbrandt@yahoo.com", "evelyn.marsh@aol.com"];
const DEMO_PROJECT_CODES = ["GID-2026-014", "GID-2026-015", "GID-2026-012", "GID-2026-011", "GID-2026-009", "GID-2026-006", "GID-2026-003"];
const DEMO_PROPOSAL_TOKENS = ["demo-shah-proposal-v2", "demo-delgado-refresh"];
const DEMO_SUBSCRIBER_EMAILS = ["p.campbell@gmail.com", "ann.marie.w@yahoo.com", "nurse.reid@manchesterhealth.gov.jm", "kmorgan@outlook.com", "info@stannseniorcare.org"];

// --------------------------------------------------------------------------------------------------------------------
const changes: string[] = [];
const note = (s: string) => { changes.push(s); console.log(`${DRY ? "[dry-run] " : ""}${s}`); };
async function write(label: string, fn: () => Promise<unknown>) { note(label); if (!DRY) await fn(); }

function selfTest() {
  const cases: [string, string][] = [
    ["Residential · Commercial · Aging-in-Place", "Residential · Commercial · Aging In Place"],
    ["Certified Aging-in-Place Specialists", "Certified Aging-in-Place Specialists"],
    ["Certified Aging-In-Place Specialist (CAPS)", "Certified Aging-in-Place Specialist (CAPS)"],
    ["Certified Aging In Place Specialist (CAPS)", "Certified Aging-in-Place Specialist (CAPS)"],
    ["Aging-In-Place & Home Assessments", "Aging In Place & Home Assessments"],
    ["Aging-in-place essentials from our shop", "Aging In Place essentials from our shop"],
    ["Senior or Caregiver — Aging in Place", "Senior or Caregiver — Aging In Place"],
    ["/services/aging-in-place", "/services/aging-in-place"],
    ["/contact?from=aging-in-place", "/contact?from=aging-in-place"],
    ["aging-in-place", "aging-in-place"],
    ["media://aip.shower-grab-bar", "media://aip.shower-grab-bar"],
    ["Thank you for reaching out about aging-in-place. As Certified Aging-in-Place Specialists we start", "Thank you for reaching out about Aging In Place. As Certified Aging-in-Place Specialists we start"],
    ["Same CAPS-certified specialists and the same GID Home Readiness Assessment framework", "Same CAPS-certified specialists and the same GID Home Readiness Assessment framework"],
  ];
  let bad = 0;
  for (const [i, o] of cases) { const got = fixCasing(i); if (got !== o) { bad++; console.error(`FAIL  ${JSON.stringify(i)}\n   got ${JSON.stringify(got)}\n  want ${JSON.stringify(o)}`); } }
  const pm = fixDeep([["Quality control", "Issues identified and addressed promptly, through completion."]], SERVICE_RULES["project-management"].cols!.plan!);
  if (!same(pm, [["Monitoring & communication", "Progress tracked against the plan, issues raised early, regular updates to you."]])) { bad++; console.error("FAIL plan rules", JSON.stringify(pm)); }
  console.log(bad ? `${bad} self-test failure(s)` : `self-test ok (${cases.length + 1} cases)`);
  process.exit(bad ? 1 : 0);
}

async function main() {
  if (SELF_TEST) return selfTest();
  console.log(`Launch content patch ${DRY ? "(dry run — nothing will be written)" : "(applying)"}${OPS ? " + demo operations cleanup" : ""}`);

  // --- Site settings ---------------------------------------------------------------------------------------------
  const settingsRows = await db.select().from(S.siteSettings);
  for (const row of settingsRows) {
    const v = row.value as Record<string, unknown>;
    if (row.key === "contact" && v && typeof v === "object") {
      const next = { ...v };
      if (next.address === "Street address") next.address = "";
      if (next.addressLine2 === "City, State ZIP") next.addressLine2 = "";
      if (!same(next, v)) await write("settings.contact: remove placeholder address lines", () => db.update(S.siteSettings).set({ value: next, updatedAt: new Date() }).where(eq(S.siteSettings.key, row.key)));
    }
    if (["footer", "seo", "contact"].includes(row.key) && v && typeof v === "object") {
      const next = fixDeep(v, { casing: true });
      if (!same(next, v)) await write(`settings.${row.key}: Aging In Place casing`, () => db.update(S.siteSettings).set({ value: next, updatedAt: new Date() }).where(eq(S.siteSettings.key, row.key)));
    }
  }

  // --- Services --------------------------------------------------------------------------------------------------
  const services = await db.select().from(S.services);
  for (const s of services) {
    const rules = SERVICE_RULES[s.slug] || {};
    const all: Rules = { ...(rules.all || {}), casing: true };
    const col = (c: "plan" | "features" | "success" | "scenes") => ({ ...all, ...(rules.cols?.[c] || {}), exact: { ...(all.exact || {}), ...(rules.cols?.[c]?.exact || {}) } });
    const next: Partial<typeof s> = {};
    for (const k of ["title", "kicker", "cineLead", "cineTail", "scenesLabel", "hero", "sub", "problem", "empathy", "authority", "failure", "cta", "tiersTitle", "tiersSub", "seoTitle", "seoDescription"] as const) {
      const cur = s[k]; if (typeof cur !== "string") continue; const n = fixString(cur, all); if (n !== cur) (next as Record<string, unknown>)[k] = n;
    }
    for (const k of ["plan", "features", "success", "scenes"] as const) { const n = fixDeep(s[k], col(k)); if (!same(n, s[k])) (next as Record<string, unknown>)[k] = n; }
    for (const k of ["tiers", "steps", "beforeAfter"] as const) { const n = fixDeep(s[k], all); if (!same(n, s[k])) (next as Record<string, unknown>)[k] = n; }
    if (s.slug === "model-home" && s.testimonialQuote?.startsWith("Developer testimonial goes here")) { next.testimonialQuote = null; next.testimonialWho = null; }
    if (Object.keys(next).length) await write(`services.${s.slug}: ${Object.keys(next).join(", ")}`, () => db.update(S.services).set({ ...next, updatedAt: new Date() }).where(eq(S.services.id, s.id)));
  }

  // --- Pages + blocks --------------------------------------------------------------------------------------------
  const pages = await db.select().from(S.pages);
  for (const p of pages) {
    const seo = PAGE_SEO[p.key];
    const next: Partial<typeof p> = {};
    if (seo && (!p.seoDescription || seo.replaces?.includes(p.seoDescription))) next.seoDescription = seo.description;
    if (seo?.title && p.seoTitle === seo.title.from) next.seoTitle = seo.title.to;
    const nav = fixCasing(p.navLabel || ""); if (p.navLabel && nav !== p.navLabel) next.navLabel = nav;
    if (Object.keys(next).length) await write(`pages.${p.key}: ${Object.keys(next).join(", ")}`, () => db.update(S.pages).set({ ...next, updatedAt: new Date() }).where(eq(S.pages.id, p.id)));
    const blocks = await db.select().from(S.pageBlocks).where(eq(S.pageBlocks.pageId, p.id));
    const rules: Rules = { ...(PAGE_BLOCK_RULES[p.key] || {}), casing: true };
    for (const b of blocks) {
      const n = fixDeep(b.content, rules);
      if (!same(n, b.content)) await write(`page_blocks.${p.key}/${b.type}: content text`, () => db.update(S.pageBlocks).set({ content: n, updatedAt: new Date() }).where(eq(S.pageBlocks.id, b.id)));
    }
  }

  // --- Products --------------------------------------------------------------------------------------------------
  const fakeProducts = await db.select({ id: S.products.id, title: S.products.title }).from(S.products).where(inArray(S.products.title, FAKE_PRODUCT_TITLES));
  if (fakeProducts.length) await write(`products: delete ${fakeProducts.length} invented listing(s): ${fakeProducts.map((p) => p.title).join(" | ")}`, () => db.delete(S.products).where(inArray(S.products.id, fakeProducts.map((p) => p.id))));
  const realSeed = await db.select().from(S.products).where(eq(S.products.title, REAL_PRODUCT_SEED_TITLE));
  for (const p of realSeed) {
    await write(`products.${p.id}: hide "${p.title}" until the Etsy price/listing is confirmed in the admin (price $24.00 → unset, invented review count cleared)`, () =>
      db.update(S.products).set({ title: "GID Home Readiness Assessment — Aging In Place Checklist (PDF)", price: p.price === "$24.00" ? "$—" : p.price, reviews: "(0)", tag: p.tag === "Bestseller" ? null : p.tag, isActive: false, updatedAt: new Date() }).where(eq(S.products.id, p.id)));
  }

  // --- Caribbean events ------------------------------------------------------------------------------------------
  const fakeEvents = await db.select({ id: S.ccEvents.id, title: S.ccEvents.title, status: S.ccEvents.status }).from(S.ccEvents).where(inArray(S.ccEvents.title, FAKE_EVENT_TITLES));
  if (fakeEvents.length) await write(`cc_events: delete ${fakeEvents.length} invented event(s): ${fakeEvents.map((e) => `${e.title} [${e.status}]`).join(" | ")}`, () => db.delete(S.ccEvents).where(inArray(S.ccEvents.id, fakeEvents.map((e) => e.id))));

  // --- Posts -----------------------------------------------------------------------------------------------------
  const regional = await db.select({ id: S.posts.id, title: S.posts.title }).from(S.posts).where(and(like(S.posts.guid, "seed-cc-%"), eq(S.posts.sourceUrl, "#")));
  if (regional.length) await write(`posts: delete ${regional.length} invented regional headline(s) attributed to real publishers: ${regional.map((p) => p.title).join(" | ")}`, () => db.delete(S.posts).where(inArray(S.posts.id, regional.map((p) => p.id))));
  const seeded = await db.select().from(S.posts).where(inArray(S.posts.slug, SEED_POST_SLUGS));
  for (const p of seeded) {
    const placeholder = (p.body || "").includes(PLACEHOLDER_BODY) || (p.origin === "rss" && (!p.sourceUrl || p.sourceUrl === "#"));
    const next: Partial<typeof p> = {};
    if (placeholder) {
      if (p.status === "published") next.status = "draft";
      if (p.origin === "rss") { next.origin = "written"; next.sourceName = null; next.rssSourceId = null; next.guid = null; }
      const body = (p.body || "").replace(PLACEHOLDER_BODY, ""); if (body !== (p.body || "")) next.body = body;
    }
    const cat = fixCasing(p.category); if (cat !== p.category) next.category = cat;
    const title = fixCasing(p.title); if (title !== p.title) next.title = title;
    if (Object.keys(next).length) await write(`posts.${p.slug}: ${placeholder ? "prototype placeholder → draft; " : ""}${Object.keys(next).join(", ")}`, () => db.update(S.posts).set({ ...next, updatedAt: new Date() }).where(eq(S.posts.id, p.id)));
  }
  const otherPosts = await db.select({ id: S.posts.id, slug: S.posts.slug, category: S.posts.category }).from(S.posts);
  for (const p of otherPosts) { const cat = fixCasing(p.category); if (cat !== p.category && !seeded.some((x) => x.id === p.id)) await write(`posts.${p.slug}: category casing`, () => db.update(S.posts).set({ category: cat }).where(eq(S.posts.id, p.id))); }

  // --- RSS sources: the seed faked a sync time and item count ------------------------------------------------------
  const sources = await db.select().from(S.rssSources);
  for (const src of sources) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(S.posts).where(and(eq(S.posts.rssSourceId, src.id), or(isNull(S.posts.guid), sql`${S.posts.guid} not like 'seed-%'`)));
    if (Number(n) === 0 && (src.lastSyncedAt || src.itemCount)) await write(`rss_sources.${src.name}: clear faked sync status (never actually synced)`, () => db.update(S.rssSources).set({ lastSyncedAt: null, itemCount: 0 }).where(eq(S.rssSources.id, src.id)));
  }

  // --- Media alt text: drop image-generation directions the seed copied into alt text -------------------------------------
  for (const m of await db.select({ id: S.media.id, slot: S.media.slot, alt: S.media.alt, subject: S.media.subject }).from(S.media)) {
    if (!m.alt || m.alt !== m.subject) continue; // edited in the admin → leave alone
    const alt = m.alt.replace(/,\s*(no people|no text|editorial interior photography)\s*$/i, "").trim();
    if (alt !== m.alt) await write(`media.${m.slot}: alt text "${alt}"`, () => db.update(S.media).set({ alt, updatedAt: new Date() }).where(eq(S.media.id, m.id)));
  }

  // --- Testimonials, team, paths, sequences ---------------------------------------------------------------------------
  const fakeT = await db.select({ id: S.testimonials.id, who: S.testimonials.who }).from(S.testimonials).where(inArray(S.testimonials.quote, FAKE_TESTIMONIAL_QUOTES));
  if (fakeT.length) await write(`testimonials: delete ${fakeT.length} invented quote(s) (${fakeT.map((t) => t.who).join(", ")})`, () => db.delete(S.testimonials).where(inArray(S.testimonials.id, fakeT.map((t) => t.id))));
  for (const t of await db.select().from(S.teamMembers)) {
    const next: Partial<typeof t> = {};
    for (const k of ["credentials", "bio", "bio2", "title"] as const) { const cur = t[k]; if (typeof cur === "string") { const n = fixCasing(cur); if (n !== cur) (next as Record<string, unknown>)[k] = n; } }
    const cl = fixDeep(t.credentialList, { casing: true }); if (!same(cl, t.credentialList)) next.credentialList = cl;
    if (Object.keys(next).length) await write(`team_members.${t.name}: ${Object.keys(next).join(", ")}`, () => db.update(S.teamMembers).set({ ...next, updatedAt: new Date() }).where(eq(S.teamMembers.id, t.id)));
  }
  for (const p of await db.select().from(S.paths)) {
    const label = fixCasing(p.label), short = fixCasing(p.short);
    if (label !== p.label || short !== p.short) await write(`paths.${p.id}: label casing`, () => db.update(S.paths).set({ label, short }).where(eq(S.paths.id, p.id)));
  }
  for (const q of await db.select().from(S.emailSequences)) { const n = fixCasing(q.name); if (n !== q.name) await write(`email_sequences.${q.id}: name casing`, () => db.update(S.emailSequences).set({ name: n }).where(eq(S.emailSequences.id, q.id))); }
  for (const st of await db.select().from(S.emailSequenceSteps)) { const b = fixCasing(st.body), sj = st.subject ? fixCasing(st.subject) : st.subject; if (b !== st.body || sj !== st.subject) await write(`email_sequence_steps.${st.id}: casing`, () => db.update(S.emailSequenceSteps).set({ body: b, subject: sj }).where(eq(S.emailSequenceSteps.id, st.id))); }

  // --- Demo operations data (--ops) -----------------------------------------------------------------------------------
  if (OPS) {
    const demoUsers = await db.select({ id: S.users.id, email: S.users.email, lastLoginAt: S.users.lastLoginAt, isActive: S.users.isActive }).from(S.users).where(inArray(S.users.email, DEMO_TEAM_EMAILS));
    for (const u of demoUsers) {
      if (u.lastLoginAt) { note(`users.${u.email}: SKIPPED — this account has signed in, so it may be real; deactivate it in Admin → Users if not`); continue; }
      if (u.isActive) await write(`users.${u.email}: deactivate sample team account`, () => db.update(S.users).set({ isActive: false, updatedAt: new Date() }).where(eq(S.users.id, u.id)));
    }
    const fakeLeads = await db.select({ id: S.leads.id, name: S.leads.name, email: S.leads.email }).from(S.leads).where(or(inArray(S.leads.email, DEMO_LEAD_EMAILS), like(S.leads.email, "%@example.com")));
    if (fakeLeads.length) await write(`leads: delete ${fakeLeads.length} sample/test lead(s) with their activity and bookings: ${fakeLeads.map((l) => l.name).join(", ")}`, () => db.delete(S.leads).where(inArray(S.leads.id, fakeLeads.map((l) => l.id))));
    const fakeProjects = await db.select({ id: S.projects.id, code: S.projects.code }).from(S.projects).where(inArray(S.projects.code, DEMO_PROJECT_CODES));
    if (fakeProjects.length) await write(`projects: delete ${fakeProjects.length} sample project(s) with invoices, milestones, documents, approvals and portal links: ${fakeProjects.map((p) => p.code).join(", ")}`, () => db.delete(S.projects).where(inArray(S.projects.id, fakeProjects.map((p) => p.id))));
    const fakeProposals = await db.select({ id: S.proposals.id, token: S.proposals.token }).from(S.proposals).where(inArray(S.proposals.token, DEMO_PROPOSAL_TOKENS));
    if (fakeProposals.length) await write(`proposals: delete ${fakeProposals.length} sample proposal(s) reachable at public demo URLs`, () => db.delete(S.proposals).where(inArray(S.proposals.id, fakeProposals.map((p) => p.id))));
    const demoPortals = await db.select({ id: S.portalAccess.id }).from(S.portalAccess).where(like(S.portalAccess.token, "demo-%"));
    if (demoPortals.length) await write(`portal_access: delete ${demoPortals.length} demo portal link(s)`, () => db.delete(S.portalAccess).where(inArray(S.portalAccess.id, demoPortals.map((p) => p.id))));
    const fakeSocial = await db.select({ id: S.socialAccounts.id, network: S.socialAccounts.network }).from(S.socialAccounts).where(isNull(S.socialAccounts.accessTokenEnc));
    if (fakeSocial.length) await write(`social_accounts: delete ${fakeSocial.length} sample account(s) shown as connected without credentials (${fakeSocial.map((s) => s.network).join(", ")})`, () => db.delete(S.socialAccounts).where(inArray(S.socialAccounts.id, fakeSocial.map((s) => s.id))));
    const [{ n: fakeSocialPosts }] = await db.select({ n: sql<number>`count(*)` }).from(S.socialPosts);
    if (Number(fakeSocialPosts)) await write(`social_posts: delete ${fakeSocialPosts} sample post(s)`, () => db.delete(S.socialPosts));
    const fakeSubs = await db.select({ id: S.ccSubscribers.id }).from(S.ccSubscribers).where(or(like(S.ccSubscribers.email, "%@example.com"), inArray(S.ccSubscribers.email, DEMO_SUBSCRIBER_EMAILS)));
    if (fakeSubs.length) await write(`cc_subscribers: delete ${fakeSubs.length} sample subscriber(s) so newsletter sends never hit invented addresses`, () => db.delete(S.ccSubscribers).where(inArray(S.ccSubscribers.id, fakeSubs.map((s) => s.id))));
    const fakeNl = await db.select({ id: S.newsletterSubscribers.id }).from(S.newsletterSubscribers).where(like(S.newsletterSubscribers.email, "%@example.com"));
    if (fakeNl.length) await write(`newsletter_subscribers: delete ${fakeNl.length} test subscriber(s)`, () => db.delete(S.newsletterSubscribers).where(inArray(S.newsletterSubscribers.id, fakeNl.map((s) => s.id))));
    const fakeRes = await db.select({ id: S.ccResources.id, name: S.ccResources.name }).from(S.ccResources).where(and(inArray(S.ccResources.name, FAKE_RESOURCE_NAMES), sql`${S.ccResources.kind} <> 'curated'`));
    if (fakeRes.length) await write(`cc_resources: delete ${fakeRes.length} sample directory submission(s): ${fakeRes.map((r) => r.name).join(" | ")}`, () => db.delete(S.ccResources).where(inArray(S.ccResources.id, fakeRes.map((r) => r.id))));
  }

  console.log(`\n${changes.length} change(s) ${DRY ? "would be applied" : "applied"}.${changes.length === 0 ? " Database already matches the launch content." : ""}`);
  if (!OPS) console.log("Demo operations data (sample team accounts, leads, projects, proposals, subscribers) was left alone; add --ops to remove it.");
  await pool.end();
}

main().catch(async (e) => { console.error(e); try { await pool.end(); } catch {} process.exit(1); });
