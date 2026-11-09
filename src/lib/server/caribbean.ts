// server-only (also used by scripts/cron.ts)
import { db, ccResources, ccSubscribers, leadActivity } from "@/lib/db";
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
/** Who asked, for the consent record: the visitor's IP and the page they were on. Shared with the Healthy Home checklist (src/lib/server/walkthrough.ts). */
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
/** Not a sales inquiry → support@ inbox + Slack. */
async function notifyAdmin(type: string, name: string, id: number, details: Record<string, string>) {
  await notifyTeam({ kind: "cc_submission", title: `Caribbean Connection: new ${type} submission — ${name}`, body: `A new ${type} is waiting for review in Admin → Caribbean Connection.\n\n${Object.entries(details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n")}`, fields: Object.entries(details).map(([k, v]) => [k.replace(/_/g, " "), v] as [string, string]), adminPath: "/admin/caribbean", replyTo: details.Submitted_by, relatedType: `cc_${type}`, relatedId: id }).catch(() => {});
}
export { leadActivity, eq };
