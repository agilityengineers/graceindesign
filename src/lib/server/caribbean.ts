// server-only (also used by scripts/cron.ts)
import { db, ccResources, ccSubscribers, newsletterSubscribers, leadActivity, pages, pageBlocks } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { getObject } from "@/lib/server/storage";
import { DEFAULT_WALKTHROUGH_ITEMS } from "@/lib/wellness";
import { sendEmail } from "@/lib/server/outbox";
import { env } from "@/lib/env";
import { emitEvent } from "@/lib/server/webhooks";
import { notifyTeam } from "@/lib/server/notify";
import { countryFromLocation } from "@/lib/newsletter";
import { pushSubscriber, websiteWelcomeEmailEnabled } from "@/lib/server/insta-newsletter";

export async function submitResource(input: { kind: "suggestion" | "own"; name: string; category: string; area: string; url?: string; email: string; description: string }) {
  const [country, ...rest] = input.area.split(/\s*[·,]\s*/);
  const [row] = await db.insert(ccResources).values({ name: input.name, category: input.category, country: country || "Jamaica", area: rest.join(", ") || null, type: input.kind === "own" ? "Organization" : null, url: input.url || null, description: input.description, status: "pending", kind: input.kind, submittedByEmail: input.email, submittedByName: input.kind === "own" ? input.name : "Submitted via site" }).returning();
  await notifyAdmin("resource", row.name, row.id, { Name: row.name, Category: row.category, Area: input.area, Submitted_by: input.email, Kind: input.kind === "own" ? "Own organization" : "Suggestion" });
  await sendEmail({ to: input.email, from: "support", subject: "We received your Caribbean Connection submission", text: `Thank you — “${input.name}” is now in review. We'll email you when it's published in the Caribbean Connection directory (usually within 5 business days).\n\nGrace In Design` });
  await emitEvent("cc.submission.created", { type: "resource", id: row.id, name: row.name });
  return row;
}
export type SignupMeta = { ip?: string | null; page?: string | null };

/**
 * Caribbean Connection newsletter sign-up. The website records it, sends its own welcome (unless the admin
 * switched that off under Newsletter → Settings) and hands the person to Insta-Newsletter, the list of
 * record. A failed hand-off is kept on the row and retried by the `newsletter` cron job.
 */
export async function subscribeCaribbean(input: { email: string; segment: string; location?: string }, meta: SignupMeta = {}) {
  const email = input.email.trim().toLowerCase();
  const country = countryFromLocation(input.location);
  const consent = { consentIp: meta.ip || null, sourcePage: meta.page || null };
  const [row] = await db.insert(ccSubscribers).values({ email, segment: input.segment, location: input.location || null, country, ...consent })
    .onConflictDoUpdate({ target: ccSubscribers.email, set: { segment: input.segment, location: input.location || null, country, unsubscribedAt: null, consentedAt: new Date(), ...consent } }).returning({ id: ccSubscribers.id });
  if (await websiteWelcomeEmailEnabled()) await sendEmail({ to: email, from: "newsletter", subject: "Welcome to the Caribbean Connection newsletter", text: `You're on the list. Every few weeks we'll send new GID articles, regional stories for older adults and caregivers, directory additions and upcoming events.\n\nUnsubscribe anytime: ${env.baseUrl}/unsubscribe?e=${encodeURIComponent(email)}` });
  await notifyTeam({ kind: "subscriber", title: `Newsletter sign-up: ${email}`, body: `${email} joined the Caribbean Connection newsletter${input.segment ? ` (${input.segment})` : ""}${input.location ? ` from ${input.location}` : ""}.`, fields: [["Email", email], ["Segment", input.segment], ["Location", input.location || "—"]], adminPath: "/admin/caribbean?tab=subscribers", replyTo: email }).catch(() => {});
  await pushSubscriber("caribbean-connection", row.id).catch(() => {});
}
/** Healthy Home checklist lead magnet: emails the PDF, records the person on the Healthy Home list and hands them to Insta-Newsletter. */
export async function sendChecklistLead(email: string, meta: SignupMeta = {}) {
  const e = email.trim().toLowerCase();
  const [inserted] = await db.insert(newsletterSubscribers).values({ email: e, source: "wellness-checklist", consentIp: meta.ip || null, sourcePage: meta.page || null }).onConflictDoNothing().returning({ id: newsletterSubscribers.id });
  const pdf = await walkthroughPdf();
  await sendEmail({ to: e, from: "newsletter", subject: "Your 10-Minute Healthy Home Walk-Through", text: "Here's the checklist our specialists start with. Walk one room at a time, note what you find, and bring it to your consultation.\n\nGrace In Design", attachments: [{ filename: "healthy-home-walkthrough.pdf", contentType: "application/pdf", contentBase64: pdf.toString("base64") }] });
  await notifyTeam({ kind: "subscriber", title: `Checklist download: ${e}`, body: `${e} requested the Healthy Home Walk-Through checklist.`, fields: [["Email", e], ["Source", "Wellness checklist"]], adminPath: "/admin/newsletter?audience=healthy-home", replyTo: e }).catch(() => {});
  const id = inserted?.id ?? (await db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.email, e) }))?.id;
  if (id) await pushSubscriber("healthy-home", id).catch(() => {});
}
/**
 * The walk-through PDF to email. Set in Admin → Content → WELLness Resources → the WELL concepts block → Lead magnet:
 * an uploaded PDF (`pdf`) is sent as-is; otherwise one is generated from the checklist `items` (or the defaults).
 */
async function walkthroughPdf(): Promise<Buffer> {
  const page = await db.query.pages.findFirst({ where: eq(pages.key, "wellness") });
  const block = page ? await db.query.pageBlocks.findFirst({ where: and(eq(pageBlocks.pageId, page.id), eq(pageBlocks.type, "wellness_groups")) }) : null;
  const lm = ((block?.content as { leadMagnet?: { pdf?: unknown; items?: unknown; title?: unknown } } | undefined)?.leadMagnet) || {};
  const uploaded = typeof lm.pdf === "string" && lm.pdf.startsWith("/api/media/") && /\.pdf$/i.test(lm.pdf) ? await getObject(decodeURIComponent(lm.pdf.slice("/api/media/".length))).catch(() => null) : null;
  if (uploaded) return uploaded;
  const items = Array.isArray(lm.items) ? lm.items.filter((i): i is string => typeof i === "string" && !!i.trim()) : [];
  const { buildWalkthroughPdf } = await import("@/lib/server/pdf");
  const title = typeof lm.title === "string" ? lm.title : undefined;
  // The PDF's built-in font can't draw every character (emoji, arrows…): if the admin's wording trips it, send the standard checklist rather than nothing.
  try { return await buildWalkthroughPdf({ title, items: items.length ? items : DEFAULT_WALKTHROUGH_ITEMS }); }
  catch (err) { console.warn("Walk-through PDF: falling back to the default checklist", (err as Error).message); return buildWalkthroughPdf({ items: DEFAULT_WALKTHROUGH_ITEMS }); }
}
/** Not a sales inquiry → support@ inbox + Slack. */
async function notifyAdmin(type: string, name: string, id: number, details: Record<string, string>) {
  await notifyTeam({ kind: "cc_submission", title: `Caribbean Connection: new ${type} submission — ${name}`, body: `A new ${type} is waiting for review in Admin → Caribbean Connection.\n\n${Object.entries(details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n")}`, fields: Object.entries(details).map(([k, v]) => [k.replace(/_/g, " "), v] as [string, string]), adminPath: "/admin/caribbean", replyTo: details.Submitted_by, relatedType: `cc_${type}`, relatedId: id }).catch(() => {});
}
export { leadActivity, eq };
