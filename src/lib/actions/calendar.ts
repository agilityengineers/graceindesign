"use server";
import { eq, sql } from "drizzle-orm";
import { db, availabilityBlocks, bookings, leads, leadActivity } from "@/lib/db";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool } from "@/lib/utils";
import { getSetting, setSetting } from "@/lib/server/settings";
import { etDate, fmtWhen } from "@/lib/server/consult";
import { emitEvent } from "@/lib/server/webhooks";
import { sendEmail } from "@/lib/server/outbox";
import { buildIcs } from "@/lib/server/ics";
import { env } from "@/lib/env";

export async function addAvailabilityBlock(formData: FormData) {
  await adminAction("calendar", "availability_block", "create", async () => {
    const weekdays = formData.getAll("weekdays").map((d) => Number(d)).filter((d) => d >= 0 && d <= 6);
    const date = strOrNull(formData.get("date"));
    const startTime = str(formData.get("startTime")); const endTime = str(formData.get("endTime"));
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) throw new Error("Pick a valid start and end time");
    if (!date && !weekdays.length) throw new Error("Choose weekdays or a specific date");
    const [b] = await db.insert(availabilityBlocks).values({ label: strOrNull(formData.get("label")), weekdays: date ? [] : weekdays, date, startTime, endTime }).returning();
    return b;
  }, { back: backTo(formData, "/admin/calendar"), ok: "Availability block added", entityId: (b) => b.id, revalidate: ["/admin/calendar", "/contact"] });
}
export async function availabilityAction(formData: FormData) {
  const id = parseNum(formData.get("blockId")); const op = str(formData.get("op"));
  await adminAction("calendar", "availability_block", op, async () => {
    if (op === "delete") await db.delete(availabilityBlocks).where(eq(availabilityBlocks.id, id));
    else if (op === "toggle") await db.update(availabilityBlocks).set({ isActive: sql`not ${availabilityBlocks.isActive}` }).where(eq(availabilityBlocks.id, id));
    else if (op === "update") { const startTime = str(formData.get("startTime")); const endTime = str(formData.get("endTime")); if (startTime >= endTime) throw new Error("End must be after start"); await db.update(availabilityBlocks).set({ label: strOrNull(formData.get("label")), startTime, endTime, weekdays: formData.has("weekdays") ? formData.getAll("weekdays").map(Number) : undefined }).where(eq(availabilityBlocks.id, id)); }
    return id;
  }, { back: backTo(formData, "/admin/calendar"), ok: op === "delete" ? "Block removed" : "Block updated", entityId: () => id, revalidate: ["/admin/calendar", "/contact"] });
}
export async function saveBookingSettings(formData: FormData) {
  await adminAction("calendar", "setting", "update", async () => {
    const cur = await getSetting("booking");
    await setSetting("booking", { ...cur, durationMin: parseNum(formData.get("durationMin"), 15), bufferMin: parseNum(formData.get("bufferMin"), 15), minNoticeHours: parseNum(formData.get("minNoticeHours"), 24), horizonDays: Math.max(3, Math.min(90, parseNum(formData.get("horizonDays"), 21))), emailConfirm: bool(formData.get("emailConfirm")), smsConfirm: bool(formData.get("smsConfirm")), sendIcs: bool(formData.get("sendIcs")), attachChecklist: bool(formData.get("attachChecklist")), reminder24h: bool(formData.get("reminder24h")) });
    return "booking";
  }, { back: "/admin/calendar", ok: "Booking settings saved", entityId: (k) => k, revalidate: ["/admin/calendar", "/contact"] });
}
/** Book (or move) a consultation for an existing lead from the admin calendar. */
export async function createBooking(formData: FormData) {
  const leadId = parseNum(formData.get("leadId")); const existing = formData.get("bookingId") ? parseNum(formData.get("bookingId")) : null;
  await adminAction("calendar", "booking", existing ? "reschedule" : "create", async (user) => {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!lead) throw new Error("Pick a lead");
    const ymd = str(formData.get("date")); const hm = str(formData.get("time")); if (!ymd || !hm) throw new Error("Pick a date and time");
    const booking = await getSetting("booking");
    const start = etDate(ymd, hm); const end = new Date(start.getTime() + (parseNum(formData.get("durationMin")) || booking.durationMin) * 60000);
    let row;
    if (existing) { [row] = await db.update(bookings).set({ startsAt: start, endsAt: end, status: "booked", updatedAt: new Date() }).where(eq(bookings.id, existing)).returning(); }
    else { [row] = await db.insert(bookings).values({ leadId, startsAt: start, endsAt: end, type: str(formData.get("type")) || "discovery_15", notes: strOrNull(formData.get("notes")) }).returning(); }
    await db.insert(leadActivity).values({ leadId, userId: user.id, type: "booking", body: `${existing ? "Consultation moved to" : "Consultation booked for"} ${fmtWhen(start)} by ${user.name}`, meta: { bookingId: row.id } });
    if (lead.stage === "new" || lead.stage === "contacted") await db.update(leads).set({ stage: "consultation_booked", updatedAt: new Date() }).where(eq(leads.id, leadId));
    if (lead.email && bool(formData.get("notify"))) {
      const ics = buildIcs({ uid: `booking-${row.id}@graceindesign.net`, start, end, summary: "Consultation with Grace In Design", description: "15-minute discovery call.", organizerEmail: env.emailFrom, organizerName: "Grace In Design", attendeeEmail: lead.email, attendeeName: lead.name, url: `${env.baseUrl}/booking/${row.id}`, sequence: existing ? 1 : 0 });
      await sendEmail({ to: lead.email, from: "consultation", subject: `${existing ? "Updated: your" : "Your"} consultation — ${fmtWhen(start)}`, relatedType: "booking", relatedId: row.id, text: `Hi ${lead.name.split(" ")[0]},\n\nYour consultation with Grace In Design is ${existing ? "now" : "confirmed for"} ${fmtWhen(start)}.\n\nManage it here: ${env.baseUrl}/booking/${row.id}\n\nGrace In Design`, attachments: [{ filename: "consultation.ics", contentType: "text/calendar", contentBase64: Buffer.from(ics).toString("base64") }] });
    }
    await emitEvent("booking.created", { bookingId: row.id, leadId, startsAt: start.toISOString(), rescheduled: !!existing });
    return row;
  }, { back: backTo(formData, "/admin/calendar"), ok: existing ? "Consultation moved" : "Consultation booked", entityId: (b) => b.id, revalidate: ["/admin/calendar", "/admin/leads"] });
}
