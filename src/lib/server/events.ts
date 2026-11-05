// server-only
import { and, eq, isNull, like, or } from "drizzle-orm";
import { db, ccEvents, type CcEvent } from "@/lib/db";
import { eventSlug, eventTimeZone, eventLocation, isEventRegion, regionLabel, usState, DEFAULT_EVENT_REGION } from "@/lib/events";
import { localDay } from "@/lib/cc-events";
import { sendEmail } from "@/lib/server/outbox";
import { emitEvent } from "@/lib/server/webhooks";
import { notifyTeam } from "@/lib/server/notify";

/**
 * Give an approved event its link (/events/<slug>) if it doesn't have one yet, and return the slug.
 * A slug is never changed once set, even when the title is edited later, so links already shared keep working.
 */
export async function ensureEventSlug(e: Pick<CcEvent, "id" | "title" | "startsAt" | "tz" | "slug">): Promise<string> {
  if (e.slug) return e.slug;
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = eventSlug(e.title, "", new Set()); // the bare title slug; anything taken starts with it
    const rows = await db.select({ slug: ccEvents.slug }).from(ccEvents).where(or(eq(ccEvents.slug, base), like(ccEvents.slug, `${base}-%`)));
    const slug = eventSlug(e.title, localDay(e.startsAt, e.tz), new Set(rows.map((r) => r.slug!).filter(Boolean)));
    try {
      const [row] = await db.update(ccEvents).set({ slug }).where(and(eq(ccEvents.id, e.id), isNull(ccEvents.slug))).returning({ slug: ccEvents.slug });
      if (row?.slug) return row.slug;
      const now = await db.query.ccEvents.findFirst({ where: eq(ccEvents.id, e.id), columns: { slug: true } }); // set by a concurrent approval
      if (now?.slug) return now.slug;
    } catch (err: any) {
      if (err?.code !== "23505") throw err; // unique violation: another event took that slug a moment ago; look again
    }
  }
  throw new Error("Couldn't create a unique link for this event — try approving again");
}

/** Region, US city/state and the matching time zone from an admin form. Unknown values fall back to the Caribbean. */
export function regionFields(formData: FormData, fallback?: Pick<CcEvent, "region" | "city" | "state">) {
  const raw = formData.get("region");
  const region = isEventRegion(raw) ? raw : (fallback?.region as string) || DEFAULT_EVENT_REGION;
  const state = region === "us" ? usState(String(formData.get("state") || ""))?.[0] || null : null;
  const city = region === "us" ? String(formData.get("city") || "").trim().slice(0, 120) || null : null;
  return { region, state, city, tz: eventTimeZone({ region, state }) };
}

export type EventSubmission = { title: string; date: string; time?: string; format: string; where?: string; host: string; email: string; description: string; url?: string; cost?: string; region?: string; state?: string; city?: string };

/**
 * A public event submission (any events form on the site: the Caribbean page, a United States page, a city page…).
 * The form's region/state/city is the submitter's answer; the admin can change it when reviewing. Saved as pending.
 */
export async function submitEvent(input: EventSubmission) {
  const region = isEventRegion(input.region) ? input.region : DEFAULT_EVENT_REGION;
  const state = region === "us" ? usState(input.state)?.[0] || null : null;
  const city = region === "us" ? input.city?.trim().slice(0, 120) || null : null;
  const country = region === "us" ? "United States" : /jamaica/i.test(input.where || "") ? "Jamaica" : "Diaspora";
  const starts = new Date(`${input.date}T12:00:00-05:00`);
  const [row] = await db.insert(ccEvents).values({ title: input.title, startsAt: isNaN(starts.getTime()) ? new Date() : starts, timeLabel: input.time || null, whereLabel: input.where || (input.format === "virtual" ? "Online" : "TBA"), format: input.format, host: input.host, url: input.url || null, cost: input.cost || "Free", description: input.description, status: "pending", submittedByEmail: input.email, submittedByName: input.host, region, state, city, country, tz: eventTimeZone({ region, state }) }).returning();
  const details: [string, string][] = [["Title", row.title], ["Date", input.date], ["Region", regionLabel(region)], ["Where", eventLocation(row)], ["Format", input.format], ["Host", input.host], ["Submitted by", input.email]];
  await notifyTeam({ kind: "cc_submission", title: `New event submission (${regionLabel(region)}) — ${row.title}`, body: `A new event is waiting for review in Admin → Events.\n\n${details.map(([k, v]) => `${k}: ${v}`).join("\n")}`, fields: details, adminPath: "/admin/events", replyTo: input.email, relatedType: "cc_event", relatedId: row.id }).catch(() => {});
  await sendEmail({ to: input.email, from: "support", subject: "We received your event submission", text: `Thank you — “${input.title}” is in review. Once it's approved we'll email you a link to its own page that you can share.\n\nGrace In Design` });
  await emitEvent("cc.submission.created", { type: "event", id: row.id, title: row.title, region });
  return row;
}
