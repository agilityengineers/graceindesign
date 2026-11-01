// server-only (also used by scripts/cron.ts)
import { db, ccResources, ccEvents, ccSubscribers, newsletterSubscribers, leadActivity } from "@/lib/db";
import { eq } from "drizzle-orm";
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
export async function submitEvent(input: { title: string; date: string; time?: string; format: string; where?: string; host: string; email: string; description: string; url?: string; cost?: string }) {
  const starts = new Date(`${input.date}T12:00:00-05:00`);
  const [row] = await db.insert(ccEvents).values({ title: input.title, startsAt: isNaN(starts.getTime()) ? new Date() : starts, timeLabel: input.time || null, whereLabel: input.where || (input.format === "virtual" ? "Online" : "TBA"), format: input.format, host: input.host, url: input.url || null, cost: input.cost || "Free", description: input.description, status: "pending", submittedByEmail: input.email, submittedByName: input.host, country: /jamaica/i.test(input.where || "") ? "Jamaica" : "Diaspora" }).returning();
  await notifyAdmin("event", row.title, row.id, { Title: row.title, Date: input.date, Format: input.format, Host: input.host, Submitted_by: input.email });
  await sendEmail({ to: input.email, from: "support", subject: "We received your event submission", text: `Thank you — “${input.title}” is in review. We'll email you when it's listed on Caribbean Connection.\n\nGrace In Design` });
  await emitEvent("cc.submission.created", { type: "event", id: row.id, title: row.title });
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
  const { buildChecklistPdf } = await import("@/lib/server/pdf");
  const pdf = await buildChecklistPdf({ name: "Friend", pathLabel: "Healthy Home Walk-Through", consultType: "10-minute checklist", when: "Anytime", items: ["Light: can you see the floor clearly on the path from bed to bathroom at night?", "Air: do bathrooms and kitchen vent outside? Any musty smell?", "Water: are hot water temperatures set below 120°F? Any slow leaks?", "Safety: loose rugs, cords across walkways, missing grab bars?", "Entry: at least one step-free way in, or a plan for one?", "Reach: can everyday items be reached without a step stool?"] });
  await sendEmail({ to: e, from: "newsletter", subject: "Your 10-Minute Healthy Home Walk-Through", text: "Here's the checklist our specialists start with. Walk one room at a time, note what you find, and bring it to your consultation.\n\nGrace In Design", attachments: [{ filename: "healthy-home-walkthrough.pdf", contentType: "application/pdf", contentBase64: pdf.toString("base64") }] });
  await notifyTeam({ kind: "subscriber", title: `Checklist download: ${e}`, body: `${e} requested the Healthy Home Walk-Through checklist.`, fields: [["Email", e], ["Source", "Wellness checklist"]], adminPath: "/admin/newsletter?audience=healthy-home", replyTo: e }).catch(() => {});
  const id = inserted?.id ?? (await db.query.newsletterSubscribers.findFirst({ where: eq(newsletterSubscribers.email, e) }))?.id;
  if (id) await pushSubscriber("healthy-home", id).catch(() => {});
}
/** Not a sales inquiry → support@ inbox + Slack. */
async function notifyAdmin(type: string, name: string, id: number, details: Record<string, string>) {
  await notifyTeam({ kind: "cc_submission", title: `Caribbean Connection: new ${type} submission — ${name}`, body: `A new ${type} is waiting for review in Admin → Caribbean Connection.\n\n${Object.entries(details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n")}`, fields: Object.entries(details).map(([k, v]) => [k.replace(/_/g, " "), v] as [string, string]), adminPath: "/admin/caribbean", replyTo: details.Submitted_by, relatedType: `cc_${type}`, relatedId: id }).catch(() => {});
}
export { leadActivity, eq };
