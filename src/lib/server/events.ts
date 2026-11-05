// server-only
import { and, eq, isNull, like, or } from "drizzle-orm";
import { db, ccEvents, type CcEvent } from "@/lib/db";
import { eventSlug, eventTimeZone, isEventRegion, usState, DEFAULT_EVENT_REGION } from "@/lib/events";
import { localDay } from "@/lib/cc-events";

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
