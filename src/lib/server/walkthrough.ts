// server-only (also used by scripts/cron.ts)
/**
 * The 10-Minute Healthy Home Walk-Through, server side: which PDF to serve, what the download page says, and what happens
 * when someone asks for it. One request fans out five ways, in this order: the Healthy Home list (a named subscriber),
 * the Leads board (a card, or a note on the card that already exists), the email with the full download link, the Slack
 * notice, and the hand-off to Insta-Newsletter. Only the first and the email are allowed to fail the request; the rest
 * are best-effort so a Slack outage never costs a visitor their checklist.
 *
 * The paths and wording live in src/lib/walkthrough.ts (client-safe); the PDF layout in src/lib/server/pdf.ts.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db, leads, leadActivity, paths, newsletterSubscribers, pages, pageBlocks } from "@/lib/db";
import { env } from "@/lib/env";
import { getObject } from "@/lib/server/storage";
import { sendEmail } from "@/lib/server/outbox";
import { notifyTeam } from "@/lib/server/notify";
import { emitEvent } from "@/lib/server/webhooks";
import { publicLead } from "@/lib/server/consult";
import { pushSubscriber } from "@/lib/server/insta-newsletter";
import type { SignupMeta } from "@/lib/server/caribbean";
import { PAGE_TO_PATH } from "@/lib/seed-data/form";
import { absoluteUrl } from "@/lib/base-url";
import { DEFAULT_LEAD_MAGNET, DEFAULT_WALKTHROUGH_ITEMS } from "@/lib/wellness";
import { WALKTHROUGH_PAGE_PATH, WALKTHROUGH_PDF_PATH, WALKTHROUGH_SOURCE_LABEL, cleanFirstName, mediaKeyFromUrl, walkthroughEmail } from "@/lib/walkthrough";

/** The Lead magnet settings of the WELLness page's WELL concepts block, as published, with the defaults for anything blank. */
export type LeadMagnetContent = { eyebrow: string; title: string; body: string; cta: string; link: string; linkHref: string; pdf: string; items: string[] };

const text = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);

export async function walkthroughLeadMagnet(): Promise<LeadMagnetContent> {
  const page = await db.query.pages.findFirst({ where: eq(pages.key, "wellness") });
  const block = page ? await db.query.pageBlocks.findFirst({ where: and(eq(pageBlocks.pageId, page.id), eq(pageBlocks.type, "wellness_groups")) }) : null;
  const lm = ((block?.content as { leadMagnet?: Record<string, unknown> } | undefined)?.leadMagnet) || {};
  const items = Array.isArray(lm.items) ? lm.items.filter((i): i is string => typeof i === "string" && !!i.trim()) : [];
  const d = DEFAULT_LEAD_MAGNET;
  return {
    eyebrow: text(lm.eyebrow, d.eyebrow), title: text(lm.title, d.title), body: text(lm.body, d.body), cta: text(lm.cta, d.cta),
    // A blank link is the admin hiding it, so only a missing field falls back.
    link: typeof lm.link === "string" ? lm.link : d.link, linkHref: typeof lm.linkHref === "string" ? lm.linkHref : d.linkHref,
    pdf: typeof lm.pdf === "string" ? lm.pdf.trim() : "", items: items.length ? items : DEFAULT_WALKTHROUGH_ITEMS,
  };
}

/** A PDF is judged by its first bytes, not its file name. */
const isPdf = (buf: Buffer) => buf.subarray(0, 5).toString("latin1") === "%PDF-";

/**
 * The checklist PDF: Grace's own upload (Lead magnet → "Your own PDF"), whole, once the page is published and the link
 * points at our media store; otherwise one generated from the checklist items (or the defaults). The email's link and
 * the download page's button both resolve here, so they can never disagree.
 */
export async function walkthroughPdf(lm?: LeadMagnetContent): Promise<Buffer> {
  const magnet = lm ?? (await walkthroughLeadMagnet());
  const key = mediaKeyFromUrl(magnet.pdf);
  const uploaded = key ? await getObject(key).catch(() => null) : null;
  if (uploaded && isPdf(uploaded)) return uploaded;
  const { buildWalkthroughPdf } = await import("@/lib/server/pdf");
  // The PDF's built-in font can't draw every character (emoji, arrows…): if the admin's wording trips it, send the standard checklist rather than nothing.
  try { return await buildWalkthroughPdf({ title: magnet.title, items: magnet.items }); }
  catch (err) { console.warn("Walk-through PDF: falling back to the default checklist", (err as Error).message); return buildWalkthroughPdf({ items: DEFAULT_WALKTHROUGH_ITEMS }); }
}

type LeadRow = typeof leads.$inferSelect;

/**
 * The person on the Leads board. One card per email address: a repeat request, or someone who already asked for a
 * consultation, gets a note on their existing card rather than a second one, and never has their name overwritten.
 * Checklist leads are not enrolled in the consultation follow-up sequences; Insta-Newsletter carries the nurture.
 */
async function upsertChecklistLead(firstName: string, email: string, title: string, meta: SignupMeta): Promise<{ lead: LeadRow; created: boolean }> {
  const [existing] = await db.select().from(leads).where(and(eq(leads.archived, false), sql`lower(${leads.email}) = ${email}`)).orderBy(desc(leads.createdAt)).limit(1);
  if (existing) {
    await db.insert(leadActivity).values({ leadId: existing.id, type: "system", body: `Requested ${title} again from the WELLness Resources page`, meta: { ip: meta.ip ?? undefined } });
    return { lead: existing, created: false };
  }
  const pathId = PAGE_TO_PATH["wellness"];
  const path = pathId ? await db.query.paths.findFirst({ where: eq(paths.id, pathId) }) : null;
  const [lead] = await db.insert(leads).values({
    name: firstName, email, sourcePage: "wellness", sourceLabel: WALKTHROUGH_SOURCE_LABEL, pathId: path?.id ?? null, stage: "new", consentAt: new Date(),
    tags: [path?.short || "Aging In Place", "Checklist"], answers: { checklist: title }, followUpAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  }).returning();
  await db.insert(leadActivity).values({ leadId: lead.id, type: "system", body: `Lead created from ${WALKTHROUGH_SOURCE_LABEL}: requested "${title}" on the WELLness Resources page`, meta: { ip: meta.ip ?? undefined } });
  await emitEvent("lead.created", { lead: publicLead(lead), path: path?.id ?? null, sourcePage: "wellness", checklist: true });
  return { lead, created: true };
}

export type ChecklistRequest = { firstName: string; email: string };

/** What the visitor gets back: where to send them next, and the lead the request landed on (null if the board could not be written). */
export async function sendChecklistLead(input: ChecklistRequest, meta: SignupMeta = {}): Promise<{ leadId: number | null; next: string }> {
  const firstName = cleanFirstName(input.firstName);
  const email = input.email.trim().toLowerCase();
  const consent = { consentIp: meta.ip || null, sourcePage: meta.page || null };
  // 1. The Healthy Home list. A returning address is re-subscribed and its name recorded, as the Caribbean form does.
  const [sub] = await db.insert(newsletterSubscribers).values({ email, firstName: firstName || null, source: "wellness-checklist", ...consent })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { ...(firstName ? { firstName } : {}), source: "wellness-checklist", consentedAt: new Date(), unsubscribedAt: null, ...consent } })
    .returning({ id: newsletterSubscribers.id });
  const lm = await walkthroughLeadMagnet();
  // 2. The Leads board. A hiccup here must never cost the visitor their checklist.
  const board = await upsertChecklistLead(firstName || "Website visitor", email, lm.title, meta).catch((err) => { console.error("Checklist lead not recorded", (err as Error).message); return null; });
  const lead = board?.lead ?? null;
  // 3. The email: the full link to the PDF and to the download page, no attachment (the link always serves the current file).
  const downloadUrl = absoluteUrl(env.baseUrl, WALKTHROUGH_PDF_PATH);
  const pageUrl = absoluteUrl(env.baseUrl, WALKTHROUGH_PAGE_PATH);
  await sendEmail({ to: email, from: "newsletter", ...walkthroughEmail({ firstName, title: lm.title, downloadUrl, pageUrl }), ...(lead ? { relatedType: "lead", relatedId: lead.id } : {}) });
  if (lead) await db.insert(leadActivity).values({ leadId: lead.id, type: "email", body: "Checklist email sent with the download link" }).catch(() => {});
  // 4. The team: Slack only (a text or an inbox email per download would be noise), naming the person and opening their card.
  const who = firstName ? `${firstName} (${email})` : email;
  await notifyTeam({
    kind: "subscriber", title: `Checklist download: ${who}`,
    body: `${who} requested ${lm.title} from the WELLness Resources page.${lead ? (board?.created ? " A new lead is on the Leads board." : " Noted on their existing lead.") : ""}`,
    fields: [["Name", firstName || "—"], ["Email", email], ["Source", WALKTHROUGH_SOURCE_LABEL]],
    adminPath: lead ? `/admin/leads?open=${lead.id}` : "/admin/newsletter?audience=healthy-home", replyTo: email,
    ...(lead ? { relatedType: "lead", relatedId: lead.id } : {}),
  }).catch(() => {});
  // 5. Insta-Newsletter, the list of record (retried by the `newsletter` cron job if it fails now).
  await pushSubscriber("healthy-home", sub.id).catch(() => {});
  return { leadId: lead?.id ?? null, next: WALKTHROUGH_PAGE_PATH };
}
