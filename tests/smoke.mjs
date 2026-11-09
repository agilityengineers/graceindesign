// End-to-end smoke test for the consultation funnel + key routes. Dev-only, no framework.
//   SMOKE_BASE=http://localhost:5000 node tests/smoke.mjs
import http from "node:http";
import https from "node:https";
const base = process.env.SMOKE_BASE || "http://127.0.0.1:5000";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok, extra }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`); };
const get = async (p, opts) => { const r = await fetch(base + p, { redirect: "manual", ...opts }); return r; };
// fetch() silently drops forbidden `sec-*` headers, so browser-style requests go through node:http.
const rawGet = (p, headers) => new Promise((resolve, reject) => { const u = new URL(base + p); const req = (u.protocol === "https:" ? https : http).request(u, { method: "GET", headers }, (res) => { res.resume(); resolve({ status: res.statusCode, headers: res.headers }); }); req.on("error", reject); req.end(); });

// 1. Public routes answer 200
for (const p of ["/", "/about", "/services", "/services/residential", "/services/residential/design-refresh", "/services/residential/model-home", "/services/aging-in-place", "/services/aging-in-place/virtual", "/services/commercial", "/services/project-management", "/services/start", "/healthy-home-resources", "/healthy-home-resources/aip-products", "/healthy-home-resources/wellness", "/healthy-home-resources/wellness/checklist", "/healthy-home-resources/home-health-series", "/healthy-home-resources/aip-partners", "/caribbean-connection", "/news", "/contact", "/privacy", "/terms", "/accessibility", "/login", "/unsubscribe?e=x@y.z"]) {
  const r = await get(p); check(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
}
// 2. Admin is gated
const adm = await get("/admin"); check("GET /admin redirects to login when signed out", adm.status === 307 || adm.status === 302, `HTTP ${adm.status} → ${adm.headers.get("location")}`);
const roadmap = await get("/roadmap"); check("GET /roadmap is admin-only", roadmap.status !== 200 || (await roadmap.text()).includes("Sign in"), `HTTP ${roadmap.status}`);
// 2b. Private files on the media route are refused when signed out; site assets stay public
for (const k of ["leads/1/1700000000000-proposal.pdf", "leads/photos/abc123xyz0.jpg", "projects/1/1700000000000-plan.pdf", "leads/abc/x.pdf"]) {
  const r = await get(`/api/media/${k}`); check(`GET /api/media/${k} is refused when signed out`, r.status === 401 || r.status === 403, `HTTP ${r.status}`);
}
const nav = await rawGet("/api/media/leads/1/1700000000000-proposal.pdf", { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" });
check("a browser following a shared private link is sent to sign in", nav.status === 302 && (nav.headers.location || "").startsWith("/login?next=%2Fapi%2Fmedia%2Fleads"), `HTTP ${nav.status} → ${nav.headers.location}`);
const badPortal = await get("/api/media/projects/1/1700000000000-plan.pdf?portal=not-a-real-token"); check("a bogus portal token doesn't open project files", badPortal.status === 401, `HTTP ${badPortal.status}`);
const badKey = await get("/api/media/library/x/../leads/1/x.pdf"); check("dot segments in media keys never serve a private file", badKey.status !== 200, `HTTP ${badKey.status}`);
const homeHtml = await (await get("/")).text(); const publicKey = homeHtml.match(/\/api\/media\/((?!leads\/|projects\/)[A-Za-z0-9._/-]+)/)?.[1];
if (publicKey) { const r = await get(`/api/media/${publicKey}`); check(`public media still serves (${publicKey})`, r.status === 200 && (r.headers.get("cache-control") || "").includes("immutable"), `HTTP ${r.status} ${r.headers.get("cache-control")}`); }
else { const r = await get("/api/media/library/does-not-exist.png"); check("public media keys are not gated (missing file is 404, not 401/403)", r.status === 404, `HTTP ${r.status}`); }

// 3. Consultation funnel: schema → slots → submit → booking page
const schema = await (await get("/api/consult/schema?from=residential")).json();
check("consult schema has base fields + residential path", Array.isArray(schema.baseFields) && schema.baseFields.length > 5 && schema.pathFields?.residential?.length > 0, `${schema.baseFields?.length} base · ${schema.pathFields?.residential?.length} path`);
const slots = await (await get("/api/consult/slots")).json();
const firstDay = slots.days?.[0]; const slot = firstDay?.times?.find((t) => !t.taken);
check("availability slots are offered", !!slot, slot ? `${firstDay.label} ${slot.label}` : "no slots");
const email = `smoke+${Date.now()}@example.com`;
const submit = await get("/api/consult/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourcePage: "residential", pathId: "residential", slotIso: slot?.iso || null, utm: { utm_source: "smoke" }, website: "", answers: { name: "Smoke Test", email, phone: "(555) 010-0100", contact_pref: "Email", timeline: "1–3 months", budget: "$10k–$50k", rooms: ["Kitchen"], owner: "Yes", consent: true, notes: "Automated smoke test — safe to delete." } }) });
const sub = await submit.json().catch(() => ({}));
check("consultation submits and creates a lead", submit.status === 200 && sub.ok && sub.leadId, `HTTP ${submit.status} ${JSON.stringify(sub).slice(0, 160)}`);
if (sub.bookingId) {
  const bk = await get(`/booking/${sub.bookingId}?e=${encodeURIComponent(email)}`); check("booking confirmation page renders", bk.status === 200, `HTTP ${bk.status}`);
  const ics = await get(`/api/ics/${sub.bookingId}?e=${encodeURIComponent(email)}`); check(".ics download works", ics.status === 200 && (ics.headers.get("content-type") || "").includes("calendar"), ics.headers.get("content-type") || "");
  const pdf = await get(`/api/checklist/${sub.bookingId}?e=${encodeURIComponent(email)}`); check("checklist PDF works", pdf.status === 200 && (pdf.headers.get("content-type") || "").includes("pdf"), pdf.headers.get("content-type") || "");
} else check("booking created with the consultation", false, "no bookingId returned");
// honeypot rejects bots silently (200 but no lead)
const bot = await get("/api/consult/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourcePage: "home", answers: { name: "Bot", email: "bot@example.com" }, website: "spam" }) });
check("honeypot submissions are swallowed", bot.status === 200 || bot.status === 400, `HTTP ${bot.status}`);

// 3b. Healthy Home checklist: the PDF route answers, and a request lands on the download page
const wt = await get("/healthy-home-resources/wellness/checklist/healthy-home-walkthrough.pdf"); check("walk-through checklist PDF works", wt.status === 200 && (wt.headers.get("content-type") || "").includes("pdf"), wt.headers.get("content-type") || "");
const ck = await get("/api/newsletter/checklist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "Smoke", email: `smoke-ck+${Date.now()}@example.com` }) });
const ckj = await ck.json().catch(() => ({})); check("checklist request creates the lead and points at the download page", ck.status === 200 && ckj.ok && ckj.next === "/healthy-home-resources/wellness/checklist", `HTTP ${ck.status} ${JSON.stringify(ckj)}`);
// 4. Caribbean public forms + newsletter
const nl = await get("/api/caribbean/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `smoke-nl+${Date.now()}@example.com`, segment: "Caregiver", location: "Kingston, Jamaica" }) });
check("Caribbean newsletter signup", nl.status === 200, `HTTP ${nl.status}`);
// 5. Cron endpoint is protected
const cron = await get("/api/cron/outbox"); check("cron endpoint rejects without secret", cron.status === 401, `HTTP ${cron.status}`);
// 6. SSO / master endpoints reject unsigned calls
const sso = await get("/api/master/users", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); check("CFT master endpoint rejects unsigned requests", sso.status === 401 || sso.status === 403 || sso.status === 503, `HTTP ${sso.status}`);
const cft = await get("/api/webhooks/cft", { method: "POST", body: "{}" }); check("CFT webhook rejects unsigned requests", cft.status === 401 || cft.status === 400 || cft.status === 503, `HTTP ${cft.status}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
