// server-only (also used by scripts/cron.ts)
/** Consultation funnel: schema for the form, availability slots, submission. */
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db, paths, formFields, availabilityBlocks, bookings, leads, leadActivity, users } from "@/lib/db";
import { getSettings } from "@/lib/server/settings";
import { PAGE_TO_PATH, PAGE_LABELS, STEPS } from "@/lib/seed-data/form";
import { env } from "@/lib/env";
import { sendEmail, sendSms } from "@/lib/server/outbox";
import { buildIcs } from "@/lib/server/ics";
import { buildChecklistPdf } from "@/lib/server/pdf";
import { emitEvent } from "@/lib/server/webhooks";
import { normalizePhone } from "@/lib/server/outbox";
import { enrollLeadInSequences } from "@/lib/server/sequences";

export const TZ = "America/New_York";

export async function getConsultSchema(sourcePage: string) {
  const [pathRows, fields, settings] = await Promise.all([
    db.select().from(paths).where(eq(paths.isActive, true)).orderBy(asc(paths.sort)),
    db.select().from(formFields).where(eq(formFields.visible, true)).orderBy(asc(formFields.sort)),
    getSettings(["consult_form", "booking"]),
  ]);
  const inferred = PAGE_TO_PATH[sourcePage] ?? pathRows.find((p) => p.pageKeys.includes(sourcePage))?.id ?? null;
  return {
    sourcePage, sourceLabel: PAGE_LABELS[sourcePage] || "Website", inferredPath: inferred,
    mode: settings.consult_form.mode, allowToggle: settings.consult_form.allowVisitorToggle,
    steps: STEPS,
    paths: pathRows.map((p) => ({ id: p.id, label: p.label, short: p.short, consult: p.consultType, color: p.color })),
    baseFields: fields.filter((f) => f.scope === "base").map(pub),
    pathFields: Object.fromEntries(pathRows.map((p) => [p.id, fields.filter((f) => f.scope === "path" && f.pathId === p.id).map(pub)])),
    booking: { durationMin: settings.booking.durationMin, tz: settings.booking.tz },
  };
}
const pub = (f: typeof formFields.$inferSelect) => ({ id: f.id, key: f.key, label: f.label, type: f.type, options: f.options, required: f.required, step: f.step, placeholder: f.placeholder });

// ---- Availability ----------------------------------------------------------
function etParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")), ymd: `${get("year")}-${get("month")}-${get("day")}`, hm: `${get("hour").padStart(2, "0")}:${get("minute")}` };
}
/** Build a Date for a given ET calendar day + HH:MM (handles DST via offset probing). */
export function etDate(ymd: string, hm: string): Date {
  const [y, mo, da] = ymd.split("-").map(Number); const [h, mi] = hm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, da, h, mi));
  const asEt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(guess);
  const g = (t: string) => Number(asEt.find((p) => p.type === t)?.value);
  const etAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
  return new Date(guess.getTime() - (etAsUtc - guess.getTime()));
}

export async function getAvailableSlots() {
  const { booking } = await getSettings(["booking"]);
  const blocks = await db.select().from(availabilityBlocks).where(eq(availabilityBlocks.isActive, true));
  const now = new Date();
  const earliest = new Date(now.getTime() + booking.minNoticeHours * 3600000);
  const horizon = new Date(now.getTime() + booking.horizonDays * 86400000);
  const taken = await db.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt }).from(bookings).where(and(gte(bookings.startsAt, now), lte(bookings.startsAt, horizon), ne(bookings.status, "cancelled")));
  const step = booking.durationMin + booking.bufferMin;
  const days: { ymd: string; label: string; times: { hm: string; label: string; iso: string; taken: boolean }[] }[] = [];
  for (let i = 0; i <= booking.horizonDays; i++) {
    const day = new Date(now.getTime() + i * 86400000);
    const { weekday, ymd } = etParts(day);
    const todays = blocks.filter((b) => (b.date ? b.date === ymd : b.weekdays.includes(weekday)));
    if (!todays.length) continue;
    const times: { hm: string; label: string; iso: string; taken: boolean }[] = [];
    for (const b of todays) {
      const [sh, sm] = b.startTime.split(":").map(Number); const [eh, em] = b.endTime.split(":").map(Number);
      for (let t = sh * 60 + sm; t + booking.durationMin <= eh * 60 + em; t += step) {
        const hm = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        const start = etDate(ymd, hm);
        if (start < earliest) continue;
        const end = new Date(start.getTime() + booking.durationMin * 60000);
        const isTaken = taken.some((k) => k.startsAt < end && k.endsAt > start);
        if (!times.some((x) => x.hm === hm)) times.push({ hm, label: fmtTime(start), iso: start.toISOString(), taken: isTaken });
      }
    }
    times.sort((a, b) => a.hm.localeCompare(b.hm));
    if (times.length) days.push({ ymd, label: new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(day), times });
    if (days.length >= 8) break;
  }
  return { days, durationMin: booking.durationMin, tz: TZ };
}
export function fmtTime(d: Date) { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d); }
export function fmtWhen(d: Date) { return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d) + " ET"; }

// ---- Submission -------------------------------------------------------------
export type ConsultSubmission = { sourcePage: string; pathId: string | null; answers: Record<string, unknown>; slotIso?: string | null; utm?: Record<string, string>; honeypot?: string };

export async function submitConsultation(input: ConsultSubmission, meta: { ip?: string | null }) {
  if (input.honeypot) return { ok: true as const, leadId: 0, bookingId: null, when: null, spam: true };
  const a = input.answers;
  const name = String(a.name || "").trim(); const email = String(a.email || "").trim().toLowerCase(); const phone = String(a.phone || "").trim();
  if (!name || !email || !a.consent) return { ok: false as const, error: "Name, email and consent are required." };
  const path = input.pathId ? await db.query.paths.findFirst({ where: eq(paths.id, input.pathId) }) : null;
  const { notifications, booking: bookingSettings } = await getSettings(["notifications", "booking"]);
  const sourceLabel = PAGE_LABELS[input.sourcePage] || "Website";
  const [lead] = await db.insert(leads).values({
    name, email, phone: phone || null, contactPref: str(a.contact_pref), contactTime: str(a.contact_time), sourcePage: input.sourcePage, sourceLabel, pathId: path?.id ?? null,
    utm: input.utm ?? {}, stage: "new", consentAt: new Date(), budget: str(a.budget), timeline: str(a.timeline), address: str(a.address), company: str(a.company),
    answers: a, notes: str(a.notes), followUpAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    tags: [path?.short || "General"].filter(Boolean),
  }).returning();
  await db.insert(leadActivity).values({ leadId: lead.id, type: "system", body: `Lead created from ${sourceLabel}`, meta: { ip: meta.ip ?? undefined } });

  let booking: typeof bookings.$inferSelect | null = null;
  if (input.slotIso) {
    const start = new Date(input.slotIso);
    if (!isNaN(start.getTime()) && start > new Date()) {
      const end = new Date(start.getTime() + bookingSettings.durationMin * 60000);
      const clash = await db.select({ id: bookings.id }).from(bookings).where(and(ne(bookings.status, "cancelled"), lte(bookings.startsAt, end), gte(bookings.endsAt, start))).limit(1);
      if (!clash.length) {
        [booking] = await db.insert(bookings).values({ leadId: lead.id, startsAt: start, endsAt: end, status: "booked" }).returning();
        await db.update(leads).set({ stage: "consultation_booked" }).where(eq(leads.id, lead.id));
        await db.insert(leadActivity).values({ leadId: lead.id, type: "booking", body: `Discovery call booked for ${fmtWhen(start)}`, meta: { bookingId: booking.id } });
      } else {
        await db.insert(leadActivity).values({ leadId: lead.id, type: "system", body: `Requested ${fmtWhen(start)} but the slot was taken — follow up to reschedule.` });
      }
    }
  }
  const consultType = (path?.consultType || "15-min discovery call").replace(/^15-min /, "15-minute ");
  const when = booking ? fmtWhen(booking.startsAt) : null;
  const first = name.split(" ")[0];

  // Confirmation email (+ .ics + checklist PDF)
  const attachments: { filename: string; contentType: string; contentBase64: string }[] = [];
  if (booking && bookingSettings.sendIcs) attachments.push({ filename: "grace-in-design-consultation.ics", contentType: "text/calendar", contentBase64: Buffer.from(buildIcs({ uid: `booking-${booking.id}@graceindesign.net`, start: booking.startsAt, end: booking.endsAt, summary: `${consultType} — Grace In Design`, description: `Your ${consultType} with Grace A. Williams. We'll call ${phone || "you"} at the scheduled time.`, organizerEmail: env.adminNotifyEmail, organizerName: "Grace In Design", attendeeEmail: email, attendeeName: name, url: `${env.baseUrl}/contact` })).toString("base64") });
  if (bookingSettings.attachChecklist) attachments.push({ filename: "pre-consult-checklist.pdf", contentType: "application/pdf", contentBase64: (await buildChecklistPdf({ name, pathLabel: path?.label || "Consultation", consultType, when: when || "Time to be confirmed" })).toString("base64") });
  if (bookingSettings.emailConfirm) await sendEmail({ to: email, subject: booking ? `You're booked: ${consultType} on ${when}` : "We received your request — Grace In Design", relatedType: "lead", relatedId: lead.id, attachments,
    text: booking ? `Hi ${first},\n\nYou're booked for a ${consultType} with Grace In Design on ${when}. We'll call ${phone || "the number you provided"}.\n\nA calendar invite and our pre-consult checklist are attached. Need to change the time? Reply to this email or call (770) 691-1600.\n\nSee you soon,\nGrace A. Williams\nGrace In Design` : `Hi ${first},\n\nThanks for reaching out to Grace In Design. We reply within one business day.\n\nIn the meantime, our pre-consult checklist is attached so you know what to have handy.\n\nGrace A. Williams\nGrace In Design` });
  if (booking && bookingSettings.smsConfirm && phone && normalizePhone(phone)) await sendSms({ to: phone, body: `Hi ${first}, you're booked for a ${consultType} with Grace In Design on ${when}. Reply STOP to opt out.`, relatedType: "lead", relatedId: lead.id });
  if (booking) await db.update(bookings).set({ icsSentAt: new Date() }).where(eq(bookings.id, booking.id));

  // Admin notification
  if (notifications.emailAdminOnNewLead) {
    const summary = Object.entries(a).filter(([k]) => !["consent", "photos"].includes(k)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("\n");
    await sendEmail({ to: notifications.adminEmail || env.adminNotifyEmail, subject: `New lead: ${name} (${path?.short || "General"})${booking ? ` — booked ${when}` : ""}`, relatedType: "lead", relatedId: lead.id, text: `New consultation request from ${sourceLabel}.\n\n${summary}\n\nOpen in admin: ${env.baseUrl}/admin/leads?open=${lead.id}` });
    if (notifications.smsAdminOnNewLead && notifications.adminPhone) await sendSms({ to: notifications.adminPhone, body: `New GID lead: ${name} · ${path?.short || "General"}${booking ? ` · booked ${when}` : ""}` });
  }
  await db.insert(leadActivity).values({ leadId: lead.id, type: "email", body: "Auto-reply sent to lead" });
  await emitEvent("lead.created", { lead: publicLead(lead), path: path?.id ?? null, sourcePage: input.sourcePage, booking: booking ? { id: booking.id, startsAt: booking.startsAt, endsAt: booking.endsAt } : null });
  if (booking) await emitEvent("booking.created", { bookingId: booking.id, leadId: lead.id, startsAt: booking.startsAt, endsAt: booking.endsAt, name, email, phone });
  await enrollLeadInSequences(lead.id, "new").catch(() => {});
  return { ok: true as const, leadId: lead.id, bookingId: booking?.id ?? null, when, spam: false };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : Array.isArray(v) ? v.join(", ") : null);
export function publicLead(l: typeof leads.$inferSelect) { return { id: l.id, name: l.name, email: l.email, phone: l.phone, stage: l.stage, sourcePage: l.sourcePage, sourceLabel: l.sourceLabel, pathId: l.pathId, budget: l.budget, timeline: l.timeline, tags: l.tags, createdAt: l.createdAt }; }
export { users, inArray };
