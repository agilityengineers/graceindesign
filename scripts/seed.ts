/**
 * Seed the database with the prototype data (design/*.dc.html, services-data.js, form-schema.js).
 *   npm run db:seed               # seeds; refuses if data already exists
 *   npm run db:seed -- --if-empty # no-op when data exists (used by Replit workflows)
 *   npm run db:seed -- --force    # wipe all tables and reseed
 */
import "dotenv/config";
import { sql, eq, is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db, pool } from "../src/lib/db";
import * as S from "../src/lib/db/schema";
import { env } from "../src/lib/env";
import { SETTINGS_DEFAULTS } from "../src/lib/server/settings";
import { MEDIA_SLOTS } from "../src/lib/seed-data/media";
import { PATHS, BASE_FIELDS, PATH_FIELDS } from "../src/lib/seed-data/form";
import { SERVICES } from "../src/lib/seed-data/services";
import { PAGES } from "../src/lib/seed-data/pages";
import * as D from "../src/lib/seed-data/demo";
import { slugify } from "../src/lib/utils";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const IF_EMPTY = args.includes("--if-empty");
// Demo timestamps are expressed in Eastern time so "today" in the admin matches the day the seed ran.
const TZ = "America/New_York";
const etParts = (d: Date) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute }; };
const etDate = (dayOffset: number, h: number, mi: number) => { const now = etParts(new Date()); const guess = new Date(Date.UTC(now.y, now.m - 1, now.d + dayOffset, h, mi)); const off = (() => { const q = etParts(guess); return Date.UTC(q.y, q.m - 1, q.d, q.h, q.mi) - guess.getTime(); })(); return new Date(guess.getTime() - off); };
const daysAgo = (n: number, h = 9, mi = 0) => etDate(-n, h, mi);
const dateOnly = (n: number) => { const p = etParts(etDate(n, 12, 0)); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };

async function main() {
  const existing = await db.select({ n: sql<number>`count(*)` }).from(S.users);
  const hasData = Number(existing[0].n) > 0;
  if (hasData && IF_EMPTY) { console.log("Seed skipped: data already present."); await pool.end(); return; }
  if (hasData && !FORCE) { console.error("Database already has data. Use --force to wipe and reseed, or --if-empty to skip."); process.exit(1); }
  if (hasData && FORCE) {
    console.log("Wiping tables …");
    const tables = Object.values(S).filter((t) => is(t, PgTable)).map((t) => getTableName(t as PgTable));
    await db.execute(sql.raw(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
  }

  // --- Users ------------------------------------------------------------
  console.log("Users …");
  const userIds: Record<string, number> = {};
  for (const u of D.DEMO_USERS) {
    const isOwner = env.seedOwnerEmails.includes(u.email) || u.role === "owner";
    const [row] = await db.insert(S.users).values({ email: u.email, name: u.name, role: isOwner ? "owner" : (u.role as S.UserRole), isSuperAdmin: u.email === env.seedSuperAdminEmail, title: u.title, avatarUrl: u.avatar, invitedAt: new Date() }).returning();
    userIds[u.email] = row.id;
  }
  for (const email of env.seedOwnerEmails) {
    if (!userIds[email]) { const [row] = await db.insert(S.users).values({ email, name: email.split("@")[0], role: "owner", isSuperAdmin: email === env.seedSuperAdminEmail, invitedAt: new Date() }).returning(); userIds[email] = row.id; }
  }
  const grace = userIds["info@graceindesign.net"];

  // --- Settings & integrations ------------------------------------------
  console.log("Settings …");
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) await db.insert(S.siteSettings).values({ key, value: value as unknown }).onConflictDoNothing();
  for (const [key, name, purpose, phase] of D.INTEGRATIONS) {
    const status = key === "sendgrid" ? (env.sendgridApiKey ? "connected" : "not_connected") : key === "twilio" ? (env.twilio.sid ? "connected" : "not_connected") : key === "rss" ? "connected" : key === "etsy" ? "connected" : key === "cft" ? (env.cft.ssoSecret || env.cft.webhookSecret ? "connected" : "not_connected") : key === "stripe" ? (env.stripe.secret ? "connected" : "planned") : phase >= 3 ? "not_connected" : "not_connected";
    await db.insert(S.integrations).values({ key, name, purpose, phase, status }).onConflictDoNothing();
  }

  // --- Paths & form fields ---------------------------------------------
  console.log("Form schema …");
  for (const [i, p] of PATHS.entries()) await db.insert(S.paths).values({ id: p.id, label: p.label, short: p.short, consultType: p.consult, pageKeys: [...p.pages], color: p.color, sort: i });
  for (const [i, f] of BASE_FIELDS.entries()) await db.insert(S.formFields).values({ key: f.key, label: f.label, type: f.type, options: f.options ?? [], required: !!f.required, scope: "base", step: f.step || "project", sort: i, placeholder: f.placeholder });
  for (const [pathId, fields] of Object.entries(PATH_FIELDS)) for (const [i, f] of fields.entries()) await db.insert(S.formFields).values({ key: f.key, label: f.label, type: f.type, options: f.options ?? [], required: !!f.required, scope: "path", pathId, step: "project", sort: i, placeholder: f.placeholder });
  for (const a of D.AVAILABILITY) await db.insert(S.availabilityBlocks).values({ label: a.label, weekdays: [...a.weekdays], startTime: a.startTime, endTime: a.endTime });

  // --- Project pipeline config -----------------------------------------
  console.log("Pipeline config …");
  const stageIdByName: Record<string, number> = {};
  for (const [pi, ph] of D.DEFAULT_PHASES.entries()) {
    const [phase] = await db.insert(S.projectPhases).values({ name: ph.name, color: ph.color, sort: pi }).returning();
    for (const [si, [name, automation]] of ph.stages.entries()) { const [st] = await db.insert(S.projectStages).values({ phaseId: phase.id, name, sort: si, automation }).returning(); stageIdByName[name] = st.id; }
  }
  for (const [i, [key, label, type]] of D.PROJECT_FIELDS.entries()) await db.insert(S.projectFields).values({ key, label, type, sort: i });

  // --- Media -----------------------------------------------------------
  console.log("Media …");
  for (const ms of MEDIA_SLOTS) {
    await db.insert(S.media).values({ name: ms.brand ? ms.brand.split("/").pop()! : `${ms.slot}.jpg`, url: ms.brand ?? ms.remote ?? "", remoteUrl: ms.remote, storageKey: null, alt: ms.subject, slot: ms.slot, subject: ms.subject, aspect: ms.aspect, usedOn: ms.usedOn, source: ms.brand ? "brand" : "remote", magnificCreationId: ms.magnificId });
  }

  // --- Services --------------------------------------------------------
  console.log("Services …");
  const serviceIdBySlug: Record<string, number> = {};
  const serviceIdByTitle: Record<string, number> = {};
  for (const s of SERVICES) {
    const [row] = await db.insert(S.services).values({ slug: s.slug, title: s.title, kicker: s.kicker, sort: s.sort, navGroup: s.navGroup ?? "services", heroStyle: s.heroStyle ?? "cinematic", cineLead: s.cineLead, cineTail: s.cineTail, scenesLabel: s.scenesLabel, scenes: s.scenes.map(([name, word, line, img]) => ({ name, word, line, img })), hero: s.hero, sub: s.sub, problem: s.problem, empathy: s.empathy, authority: s.authority, plan: s.plan, success: s.success, failure: s.failure, features: s.features, tiers: s.tiers ?? null, steps: s.steps ?? null, img: s.img, img2: s.img2, cta: s.cta, beforeAfter: s.beforeAfter ? { before: s.beforeAfter[0], after: s.beforeAfter[1], title: s.beforeAfter[2] } : null, pathId: PATHS.some((p) => p.id === s.slug) ? s.slug : null, tiersTitle: s.slug === "virtual-assessment" ? "Choose how you'd like to be assessed" : s.tiers ? "Choose the level that fits your community" : null, tiersSub: s.slug === "virtual-assessment" ? "Flat-fee options, quoted at booking. Fees credit toward an in-home assessment or design project." : s.tiers ? "Pricing is quoted per model based on floor plan, tier and schedule. Tell us about the community and we'll follow up with a proposal." : null, testimonialQuote: s.slug === "model-home" ? "Developer testimonial goes here — two sentences about absorption, buyer response or the install experience." : null, testimonialWho: s.slug === "model-home" ? "Name, Title · Developer (placeholder)" : null }).returning();
    serviceIdBySlug[s.slug] = row.id; serviceIdByTitle[s.title] = row.id;
  }
  for (const s of SERVICES) if (s.parent) await db.update(S.services).set({ parentId: serviceIdBySlug[s.parent] }).where(eq(S.services.id, serviceIdBySlug[s.slug]));

  // --- Pages & blocks --------------------------------------------------
  console.log("Pages …");
  for (const p of PAGES) {
    const [page] = await db.insert(S.pages).values({ key: p.key, slug: p.slug, title: p.title, navLabel: p.navLabel, heroStyle: p.heroStyle ?? "cinematic", seoTitle: p.seoTitle ?? `${p.title} · Grace In Design`, seoDescription: p.seoDescription ?? null, sort: p.sort, parentKey: p.parentKey ?? null, status: p.status ?? "published", publishedAt: new Date() }).returning();
    for (const [i, b] of p.blocks.entries()) await db.insert(S.pageBlocks).values({ pageId: page.id, type: b.type, sort: i, content: b.content });
  }

  // --- Team, testimonials, products, RSS, posts -------------------------
  console.log("Content …");
  await db.insert(S.teamMembers).values({ name: D.TEAM.name, title: D.TEAM.title, credentials: D.TEAM.credentials, quote: D.TEAM.quote, bio: D.TEAM.bio, bio2: D.TEAM.bio2, education: [...D.TEAM.education], credentialList: [...D.TEAM.credentialList], photoUrl: D.TEAM.photo, sort: 0 });
  for (const [i, [quote, who, where, slug]] of D.TESTIMONIALS.entries()) await db.insert(S.testimonials).values({ quote, who, whereLabel: where, serviceSlug: slug, sort: i });
  for (const [i, [title, category, price, reviews, featured, image, tag, type]] of D.PRODUCTS.entries()) await db.insert(S.products).values({ etsyUrl: D.ETSY_LISTING, title, category, price, reviews, featured, imageUrl: image, tag, type, sort: i });
  const rssIdByName: Record<string, number> = {};
  for (const [name, url, scope, country] of D.RSS_SOURCES) { const [r] = await db.insert(S.rssSources).values({ name, url, scope, country, lastSyncedAt: daysAgo(0, new Date().getHours() - 1), itemCount: scope === "news" ? 2 : 1 }).returning(); rssIdByName[name] = r.id; }
  for (const [slug, title, category, excerpt, image, origin, status, ago, scope, featured, sourceName] of D.POSTS) {
    await db.insert(S.posts).values({ slug, title, category, excerpt, imageUrl: image, origin, scope, status, featured, publishedAt: status === "published" ? daysAgo(ago) : null, sourceName: sourceName ?? null, rssSourceId: sourceName ? rssIdByName[sourceName] : null, authorId: grace, body: `<p>${excerpt}</p><p>This article is a placeholder seeded from the prototype. Edit it under Content → News & Insights.</p>`, guid: origin === "rss" ? `seed-${slug}` : null });
  }
  for (const [title, source, ago, image] of D.CC_REGIONAL_NEWS) {
    await db.insert(S.posts).values({ slug: slugify(title), title, category: "Regional news", excerpt: null, imageUrl: image, origin: "rss", scope: "caribbean", status: "published", publishedAt: daysAgo(ago), sourceName: source, sourceUrl: "#", rssSourceId: Object.entries(rssIdByName).find(([n]) => n.startsWith(source.split(" —")[0]))?.[1] ?? null, guid: `seed-cc-${slugify(title)}` });
  }

  // --- Caribbean Connection --------------------------------------------
  console.log("Caribbean Connection …");
  for (const [i, [name, status]] of D.CC_COUNTRIES.entries()) await db.insert(S.ccCountries).values({ name, status, sort: i });
  for (const [i, r] of D.CC_RESOURCES.entries()) {
    const [status, name, category, country, area, type, kind, byName, byEmail, description, ago] = r;
    await db.insert(S.ccResources).values({ name, category, country, area, type, kind, status, submittedByName: byName, submittedByEmail: byEmail, description, reviewedBy: status === "pending" ? null : grace, publishedAt: status === "published" ? daysAgo(ago) : null, createdAt: daysAgo(ago), sort: i, reviewNote: status === "rejected" ? "Commercial lender, not a support resource." : null });
  }
  for (const [status, title, where, format, host, by, inDays, timeLabel, description, country] of D.CC_EVENTS) {
    await db.insert(S.ccEvents).values({ title, startsAt: daysAgo(-inDays, 10), timeLabel, whereLabel: where, format, host, description, country, status, submittedByName: by, submittedByEmail: by === "GID" ? null : `${slugify(by)}@example.com`, reviewedBy: status === "pending" ? null : grace, publishedAt: status === "published" ? daysAgo(20) : null, reviewNote: status === "rejected" ? "Sales presentation, not a community resource." : null });
  }
  for (const [email, segment, location, ago] of D.CC_SUBSCRIBERS) await db.insert(S.ccSubscribers).values({ email, segment, location, country: location.includes("Jamaica") ? "Jamaica" : "Diaspora", consentedAt: daysAgo(ago), createdAt: daysAgo(ago) });
  // Subscriber counts in the prototype (418) — pad with anonymized demo rows so segments match the admin mock.
  const segs: [string, number][] = [["Living in Jamaica", 163], ["In the diaspora, supporting family back home", 189], ["A caregiver or care professional", 47], ["A community organization or agency", 14]];
  for (const [segment, n] of segs) for (let i = 0; i < n; i++) await db.insert(S.ccSubscribers).values({ email: `subscriber${slugify(segment).slice(0, 8)}${i}@example.com`, segment, location: segment.includes("Jamaica") || segment.includes("caregiver") ? "Jamaica" : "Atlanta, USA", country: segment.includes("Jamaica") ? "Jamaica" : "Diaspora", consentedAt: daysAgo(Math.floor(Math.random() * 120)) });

  // --- Leads, activity, bookings ---------------------------------------
  console.log("Leads …");
  const leadIdByName: Record<string, number> = {};
  for (const l of D.DEMO_LEADS) {
    const created = daysAgo(l.createdDaysAgo, 9, 14);
    const [row] = await db.insert(S.leads).values({ name: l.name, email: l.email, phone: l.phone, sourcePage: l.sourcePage, sourceLabel: l.sourceLabel, pathId: l.pathId, stage: l.stage as S.LeadStage, ownerId: l.owner ? userIds[l.owner] : null, tags: l.tags, consentAt: created, budget: l.budget ?? (l.answers as any).budget ?? null, timeline: l.timeline ?? null, answers: l.answers, followUpAt: l.followUp, createdAt: created, updatedAt: created, contactPref: "Email" }).returning();
    leadIdByName[l.name] = row.id;
    for (const [type, body, ago] of l.activity) await db.insert(S.leadActivity).values({ leadId: row.id, userId: type === "system" ? null : grace, type, body, createdAt: daysAgo(ago, 10) });
    if (l.booking) {
      const starts = daysAgo(-l.booking.days, l.booking.hour, l.booking.minute);
      const [bk] = await db.insert(S.bookings).values({ leadId: row.id, startsAt: starts, endsAt: new Date(starts.getTime() + 15 * 60000), status: "booked", icsSentAt: created }).returning();
      await db.insert(S.leadActivity).values({ leadId: row.id, type: "booking", body: `Discovery call booked for ${starts.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`, meta: { bookingId: bk.id }, createdAt: created });
    }
  }

  // --- Projects --------------------------------------------------------
  console.log("Projects …");
  for (const p of D.DEMO_PROJECTS) {
    const leadId = leadIdByName[p.lead] ?? null;
    const [row] = await db.insert(S.projects).values({ code: p.code, name: p.name, leadId: D.DEMO_LEADS.find((l) => l.name === p.lead)?.stage === "won" ? leadId : null, leadName: p.lead, serviceId: serviceIdByTitle[p.service] ?? null, serviceName: p.service, stageId: stageIdByName[p.stage], ownerId: userIds[p.owner], contractValue: String(p.value), signedAt: dateOnly(-p.signedDaysAgo), targetDate: dateOnly(p.targetDays), address: p.address, nextMilestone: p.nextMilestone, status: p.status, closedAt: p.status !== "active" ? daysAgo(-p.targetDays) : null, createdAt: daysAgo(p.signedDaysAgo), scope: `${p.service} for ${p.lead}.` }).returning();
    // Only leads the demo marks as won are linked as "converted"; the other projects are earlier engagements for the same clients.
    const demoLead = D.DEMO_LEADS.find((l) => l.name === p.lead);
    if (leadId && demoLead?.stage === "won") await db.update(S.leads).set({ convertedProjectId: row.id }).where(eq(S.leads.id, leadId));
    for (const [i, [label, amount, status]] of p.invoices.entries()) await db.insert(S.invoices).values({ projectId: row.id, label, amount: String(amount), status, sort: i, paidAt: status === "paid" ? daysAgo(p.signedDaysAgo - 1) : null, dueAt: status === "paid" ? null : dateOnly(14 * (i + 1)) });
    for (const [i, [title, dayOffset, done]] of p.milestones.entries()) await db.insert(S.milestones).values({ projectId: row.id, title, dueAt: dateOnly(dayOffset), doneAt: done ? daysAgo(-dayOffset) : null, sort: i });
    await db.insert(S.documents).values([{ projectId: row.id, name: "Signed agreement.pdf", url: "#", type: "agreement" }, { projectId: row.id, name: "Proposal v2.pdf", url: "#", type: "proposal" }, { projectId: row.id, name: "Lead form answers", url: "#", type: "answers", visibleToClient: false }]);
    await db.insert(S.projectActivity).values({ projectId: row.id, userId: grace, type: "system", body: `Project created from lead “${p.lead}”`, createdAt: daysAgo(p.signedDaysAgo) });
  }

  // --- Phase 3 / 4 demo ------------------------------------------------
  console.log("Social & ops …");
  for (const [network, display, followers, status] of D.SOCIAL_DEMO.networks) await db.insert(S.socialAccounts).values({ network, displayName: display, followers, status, connectedAt: status === "connected" ? daysAgo(40) : null });
  for (const [body, networks, dayOffset, hour, status] of D.SOCIAL_DEMO.posts) await db.insert(S.socialPosts).values({ body, networks: [...networks], scheduledAt: daysAgo(-dayOffset, hour), status, publishedAt: status === "published" ? daysAgo(-dayOffset, hour) : null, metrics: status === "published" ? { instagram: { impressions: 1820, engagements: 131, clicks: 34 } } : {}, createdBy: grace });
  for (const [name, category, body] of D.SMS_TEMPLATES) await db.insert(S.smsTemplates).values({ name, category, body });
  for (const seq of D.EMAIL_SEQUENCES) {
    const [row] = await db.insert(S.emailSequences).values({ name: seq.name, triggerPathId: seq.path, triggerStage: seq.stage as S.LeadStage }).returning();
    for (const [i, [delay, channel, subject, body]] of seq.steps.entries()) await db.insert(S.emailSequenceSteps).values({ sequenceId: row.id, sort: i, delayHours: delay, channel, subject, body });
  }

  // Proposals + client portal links so Phase 4 screens have something to show.
  const shahLead = leadIdByName["Daniel & Priya Shah"]; const delgadoLead = leadIdByName["Rosa Delgado"];
  const projectRows = await db.select({ id: S.projects.id, code: S.projects.code, leadId: S.projects.leadId, leadName: S.projects.leadName }).from(S.projects);
  const shahProject = projectRows.find((p) => p.code === "GID-2026-014"); const delgadoProject = projectRows.find((p) => p.code === "GID-2026-015");
  await db.insert(S.proposals).values([
    { leadId: shahLead ?? null, projectId: null, title: "Shah Residence — Kitchen design & project management (v2)", body: "<p>Thank you for inviting us into your home. This proposal covers full kitchen design, finish selections, contractor coordination and weekly site visits through installation.</p><h3>Scope</h3><ul><li>Space planning and two concept directions</li><li>Cabinetry, counters, lighting and fixture specifications</li><li>Bid review with two vetted contractors</li><li>Project management through final walk-through</li></ul><h3>Investment</h3><p>$68,400 — 50% deposit on signing, 30% at procurement, 20% on completion.</p>", amount: "68400", status: "viewed", token: "demo-shah-proposal-v2", recipientEmail: "dpshah@outlook.com", recipientName: "Daniel & Priya Shah", sentAt: daysAgo(5, 10), viewedAt: daysAgo(4, 19), createdBy: grace, createdAt: daysAgo(5, 9) },
    { leadId: delgadoLead ?? null, projectId: delgadoProject?.id ?? null, title: "Design Refresh package — living room & dining", body: "<p>A one-day styling refresh using what you already own, plus a curated shopping list.</p><p>Investment: $1,850, due on signing.</p>", amount: "1850", status: "signed", token: "demo-delgado-refresh", recipientEmail: "rosa.delgado@me.com", recipientName: "Rosa Delgado", sentAt: daysAgo(12, 11), viewedAt: daysAgo(12, 14), signedAt: daysAgo(10, 9), signerName: "Rosa Delgado", signerIp: "203.0.113.24", esignProvider: "builtin", createdBy: grace, createdAt: daysAgo(12, 10) },
  ]);
  for (const p of projectRows) { const email = D.DEMO_LEADS.find((l) => l.name === p.leadName)?.email; if (email) await db.insert(S.portalAccess).values({ projectId: p.id, email, token: p.code === "GID-2026-014" ? "demo-shah-portal" : `demo-${p.code.toLowerCase()}`, lastUsedAt: p.code === "GID-2026-014" ? daysAgo(1, 20) : null }); }
  if (shahProject) await db.insert(S.approvals).values({ projectId: shahProject.id, title: "Approve: cabinet finish & hardware", description: "Please review the two finish boards in your documents and let us know which direction to order.", status: "pending", requestedAt: daysAgo(2, 15) });

  console.log("Seed complete.");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
