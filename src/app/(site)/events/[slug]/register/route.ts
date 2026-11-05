import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/data/site";
import { safeRegistrationUrl } from "@/lib/event-stats";
import { eventPath } from "@/lib/events";
import { countEventRequest } from "@/lib/server/event-stats-request";
export const dynamic = "force-dynamic";

/**
 * The event page's Register button: count the click, then forward to the third-party registration page (Eventbrite, Zoom…).
 * Works without JavaScript. Only the event's own saved link is ever used, so this can't be turned into an open redirect.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const e = await getEventBySlug(slug);
  const target = safeRegistrationUrl(e?.url);
  if (!e || !target) return NextResponse.redirect(new URL(e ? eventPath(slug) : "/events", req.url), 302);
  await countEventRequest(req, e, "register");
  const res = NextResponse.redirect(target, 302);
  res.headers.set("x-robots-tag", "noindex, nofollow"); res.headers.set("cache-control", "no-store");
  return res;
}
