import { eq } from "drizzle-orm";
import { db, bookings, leads, paths } from "@/lib/db";
import { buildIcs } from "@/lib/server/ics";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const e = new URL(req.url).searchParams.get("e") || "";
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, Number(id)) }); if (!b) return new Response("Not found", { status: 404 });
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, b.leadId) }); if (!lead || (lead.email || "").toLowerCase() !== e.toLowerCase()) return new Response("Not found", { status: 404 });
  const path = lead.pathId ? await db.query.paths.findFirst({ where: eq(paths.id, lead.pathId) }) : null;
  const summary = `${(path?.consultType || "15-min discovery call").replace(/^15-min /, "15-minute ")} — Grace In Design`;
  const ics = buildIcs({ uid: `booking-${b.id}@graceindesign.net`, start: b.startsAt, end: b.endsAt, summary, description: `Your consultation with Grace A. Williams. We'll call ${lead.phone || "you"}.`, organizerEmail: env.adminNotifyEmail, organizerName: "Grace In Design", attendeeEmail: lead.email || undefined, attendeeName: lead.name, url: `${env.baseUrl}/booking/${b.id}?e=${encodeURIComponent(lead.email || "")}`, method: b.status === "cancelled" ? "CANCEL" : "REQUEST" });
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="grace-in-design-consultation.ics"` } });
}
