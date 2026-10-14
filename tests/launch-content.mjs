// Launch-content regression: no prototype/admin text may reach visitors, and the SEO plumbing answers.
//   SMOKE_BASE=http://localhost:5000 node tests/launch-content.mjs
// Read-only: it only GETs pages (unlike tests/smoke.mjs, which writes leads).
const base = process.env.SMOKE_BASE || "http://127.0.0.1:5000";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`); };

const PUBLIC = ["/", "/about", "/services", "/services/residential", "/services/residential/design-refresh", "/services/residential/model-home", "/services/aging-in-place", "/services/aging-in-place/virtual", "/services/commercial", "/services/project-management", "/services/start", "/healthy-home-resources", "/healthy-home-resources/aip-products", "/healthy-home-resources/wellness", "/healthy-home-resources/home-health-series", "/healthy-home-resources/aip-partners", "/caribbean-connection", "/news", "/contact", "/privacy", "/terms", "/accessibility"];

// Strings Grace's review (Oct 2026) flagged, plus the admin-facing copy found alongside them. Case-sensitive.
const FORBIDDEN = [
  "Street address", "City, State ZIP",
  "Admins swap", "Admins add new listings", "admin form builder", "visible on the admin dashboard", "appear in the admin", "set by the admin", "on our dashboard",
  "seeded from the prototype", "Developer testimonial goes here", "Developer (placeholder)", "(placeholder)",
  "Hundreds of home assessments", "hundreds of homeowners", "We install assistive devices", "Ramp installation",
  "A open office", "A open ",
  "Get Started — It's Free",
  "on time, within budget", "On time, within budget", "Construction project management",
  "Aging-In-Place", "Aging in Place", "aging-in-place essentials", "aging-in-place network", "aging-in-place solutions",
  "Certified Aging In Place Specialist", "Certified Aging-In-Place Specialist",
  "Synced from RSS", "Updated hourly via RSS", "★★★★★",
  "GID × NCSC", "GID × AJA", "Timeshare Presentation",
  "Admin login",
];
// Decode the handful of entities React emits for these characters so matches are made on visible text.
const visible = (html) => html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x2014;|&mdash;/g, "—").replace(/&#xD7;|&times;/g, "×").replace(/&#x2605;/g, "★");

for (const p of PUBLIC) {
  const r = await fetch(base + p, { redirect: "manual" });
  const html = visible(await r.text());
  check(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
  const hits = FORBIDDEN.filter((s) => html.includes(s));
  check(`${p} has no prototype/admin text`, hits.length === 0, hits.join(" | "));
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || "";
  check(`${p} has a title and meta description`, title.length > 3 && desc.length > 40, `${title} / ${desc.slice(0, 60)}`);
  check(`${p} has a canonical link`, /<link rel="canonical" href="[^"]+"/.test(html));
}

// Unique titles and descriptions across the public pages
const metas = await Promise.all(PUBLIC.map(async (p) => { const h = await (await fetch(base + p)).text(); return [p, h.match(/<title>([^<]*)<\/title>/)?.[1] || "", h.match(/<meta name="description" content="([^"]*)"/)?.[1] || ""]; }));
const dupTitles = metas.filter(([, t], i) => metas.findIndex(([, t2]) => t2 === t) !== i).map(([p]) => p);
const dupDescs = metas.filter(([, , d], i) => metas.findIndex(([, , d2]) => d2 === d) !== i).map(([p]) => p);
check("page titles are unique", dupTitles.length === 0, dupTitles.join(", "));
check("meta descriptions are unique", dupDescs.length === 0, dupDescs.join(", "));

// SEO plumbing
const robots = await fetch(base + "/robots.txt"); const robotsTxt = await robots.text();
check("robots.txt answers and blocks /admin", robots.status === 200 && /Disallow: \/admin/.test(robotsTxt));
const sitemap = await fetch(base + "/sitemap.xml"); const sitemapXml = await sitemap.text();
check("sitemap.xml answers with service and page URLs", sitemap.status === 200 && sitemapXml.includes("/services/aging-in-place") && sitemapXml.includes("/contact"));
const icon = await fetch(base + "/icon.png"); check("favicon (icon.png) answers", icon.status === 200 && (icon.headers.get("content-type") || "").includes("image"));
for (const p of ["/login", "/unsubscribe?e=x@y.z"]) { const h = await (await fetch(base + p)).text(); check(`${p} is noindex`, /<meta name="robots" content="noindex/.test(h)); }
const blog = await fetch(base + "/blog", { redirect: "manual" }); check("/blog redirects to /news (301)", blog.status === 308 || blog.status === 301, `HTTP ${blog.status} → ${blog.headers.get("location")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
