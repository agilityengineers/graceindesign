"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leads, leadActivity, bookings, documents, LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum } from "@/lib/utils";
import { emitEvent } from "@/lib/server/webhooks";
import { convertLeadToProject } from "@/lib/server/projects";
import { enrollLeadInSequences, stopSequencesForLead } from "@/lib/server/sequences";
import { sendEmail, sendSms } from "@/lib/server/outbox";
import { publicLead } from "@/lib/server/consult";
import { syncLeadToHubspot } from "@/lib/server/hubspot";

async function setStage(leadId: number, stage: LeadStage, userId: number, via: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!lead) throw new Error("Lead not found");
  if (lead.stage === stage) return lead;
  const [updated] = await db.update(leads).set({ stage, updatedAt: new Date() }).where(eq(leads.id, leadId)).returning();
  await db.insert(leadActivity).values({ leadId, userId, type: "stage", body: `Moved to ${LEAD_STAGE_LABELS[stage]} (${via})` });
  await emitEvent("lead.stage_changed", { lead: publicLead(updated), from: lead.stage, to: stage, via });
  if (stage === "won" || stage === "lost") await stopSequencesForLead(leadId); else await enrollLeadInSequences(leadId, stage).catch(() => {});
  void syncLeadToHubspot(leadId).catch(() => {});
  return updated;
}

/** Drag & drop between board columns (no redirect). */
export async function moveLeadStage(leadId: number, stage: LeadStage) {
  const user = await requireArea("leads");
  if (!LEAD_STAGES.includes(stage)) return { ok: false, error: "bad stage" };
  await setStage(leadId, stage, user.id, "drag & drop");
  await audit(user.id, "stage", "lead", leadId, { stage });
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function updateLead(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("leads", "lead", "update", async (user) => {
    const stage = str(formData.get("stage")) as LeadStage;
    const ownerRaw = str(formData.get("ownerId"));
    const patch: Partial<typeof leads.$inferInsert> = { name: str(formData.get("name")) || undefined, email: strOrNull(formData.get("email")), phone: strOrNull(formData.get("phone")), company: strOrNull(formData.get("company")), ownerId: ownerRaw ? Number(ownerRaw) : null, followUpAt: strOrNull(formData.get("followUpAt")), budget: strOrNull(formData.get("budget")), timeline: strOrNull(formData.get("timeline")), address: strOrNull(formData.get("address")), pathId: strOrNull(formData.get("pathId")), notes: strOrNull(formData.get("notes")), updatedAt: new Date() };
    const tags = str(formData.get("tags")); if (formData.has("tags")) patch.tags = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    await db.update(leads).set(patch).where(eq(leads.id, id));
    if (stage && LEAD_STAGES.includes(stage)) await setStage(id, stage, user.id, "edited");
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    await emitEvent("lead.updated", { lead: publicLead(lead) });
    return lead;
  }, { back: backTo(formData, `/admin/leads?open=${id}`), ok: "Lead saved", entityId: () => id, revalidate: ["/admin/leads"] });
}

export async function createLead(formData: FormData) {
  await adminAction("leads", "lead", "create", async (user) => {
    const name = str(formData.get("name")); if (!name) throw new Error("Name is required");
    const [lead] = await db.insert(leads).values({ name, email: strOrNull(formData.get("email")), phone: strOrNull(formData.get("phone")), sourcePage: str(formData.get("sourcePage")) || "manual", sourceLabel: str(formData.get("sourceLabel")) || "Added manually", pathId: strOrNull(formData.get("pathId")), ownerId: user.id, stage: "new", tags: ["Manual"], notes: strOrNull(formData.get("notes")), consentAt: null }).returning();
    await db.insert(leadActivity).values({ leadId: lead.id, userId: user.id, type: "system", body: `Lead added manually by ${user.name}` });
    await emitEvent("lead.created", { lead: publicLead(lead), manual: true });
    return lead;
  }, { back: "/admin/leads", ok: "Lead added", entityId: (l) => l.id, revalidate: ["/admin/leads"] });
}

export async function addLeadActivity(formData: FormData) {
  const id = parseNum(formData.get("id")); const type = str(formData.get("type")) || "note"; const body = str(formData.get("body"));
  await adminAction("leads", "lead_activity", "create", async (user) => {
    if (!body) throw new Error("Write something first");
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) }); if (!lead) throw new Error("Lead not found");
    await db.insert(leadActivity).values({ leadId: id, userId: user.id, type, body });
    if (type === "email" && formData.get("send") === "1" && lead.email) await sendEmail({ to: lead.email, from: "consultation", subject: str(formData.get("subject")) || "A note from Grace In Design", text: body, relatedType: "lead", relatedId: id });
    if (type === "sms" && formData.get("send") === "1" && lead.phone) await sendSms({ to: lead.phone, body, relatedType: "lead", relatedId: id });
    if (lead.stage === "new" && ["call", "email", "sms"].includes(type)) await setStage(id, "contacted", user.id, type === "call" ? "call logged" : `${type} sent`);
    return id;
  }, { back: backTo(formData, `/admin/leads?open=${id}`), ok: type === "note" ? "Note saved" : "Activity logged", entityId: () => id, revalidate: ["/admin/leads"] });
}

export async function attachLeadDocument(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("leads", "document", "create", async (user) => {
    const file = formData.get("file"); const name = str(formData.get("name"));
    let url = str(formData.get("url")); let key: string | null = null; let size: number | null = null;
    if (file instanceof File && file.size > 0) { const { putObject } = await import("@/lib/server/storage"); const r = await putObject(`leads/${id}/${Date.now()}-${file.name}`, Buffer.from(await file.arrayBuffer())); url = r.url; key = r.key; size = file.size; }
    if (!url) throw new Error("Attach a file or a link");
    await db.insert(documents).values({ leadId: id, name: name || (file instanceof File ? file.name : "Proposal"), url, storageKey: key, size, type: str(formData.get("type")) || "proposal", uploadedBy: user.id });
    await db.insert(leadActivity).values({ leadId: id, userId: user.id, type: "proposal", body: `${name || "Proposal"} attached`, attachmentUrl: url });
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
    if (lead && ["new", "contacted", "consultation_booked"].includes(lead.stage) && str(formData.get("type")) === "proposal") await setStage(id, "proposal_sent", user.id, "proposal attached");
    return id;
  }, { back: backTo(formData, `/admin/leads?open=${id}`), ok: "Attached", entityId: () => id, revalidate: ["/admin/leads"] });
}

export async function markLeadSigned(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("leads", "lead", "convert", async (user) => {
    const value = formData.get("contractValue") ? parseNum(formData.get("contractValue")) : null;
    const project = await convertLeadToProject(id, user.id, { contractValue: value, targetDate: strOrNull(formData.get("targetDate")), address: strOrNull(formData.get("address")), name: strOrNull(formData.get("projectName")) });
    return project!;
  }, { back: backTo(formData, `/admin/leads?open=${id}`), ok: "Signed — project created", entityId: (p) => p?.id, revalidate: ["/admin/leads", "/admin/projects"] });
}

export async function deleteLead(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("leads", "lead", "delete", async () => { await db.delete(leads).where(eq(leads.id, id)); return id; }, { back: "/admin/leads", ok: "Lead deleted", entityId: () => id, revalidate: ["/admin/leads"] });
}
export async function archiveLead(formData: FormData) {
  const id = parseNum(formData.get("id")); const archived = formData.get("archived") !== "0";
  await adminAction("leads", "lead", archived ? "archive" : "restore", async () => { await db.update(leads).set({ archived, updatedAt: new Date() }).where(eq(leads.id, id)); return id; }, { back: "/admin/leads", ok: archived ? "Lead archived" : "Lead restored", entityId: () => id, revalidate: ["/admin/leads"] });
}
export async function cancelBooking(formData: FormData) {
  const id = parseNum(formData.get("bookingId")); const leadId = parseNum(formData.get("id"));
  await adminAction("calendar", "booking", "cancel", async (user) => {
    const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) }); if (!b) throw new Error("Booking not found");
    await db.update(bookings).set({ status: "cancelled", cancelReason: strOrNull(formData.get("reason")), updatedAt: new Date() }).where(eq(bookings.id, id));
    await db.insert(leadActivity).values({ leadId: b.leadId, userId: user.id, type: "booking", body: "Consultation cancelled" });
    await emitEvent("booking.cancelled", { bookingId: id, leadId: b.leadId });
    return id;
  }, { back: backTo(formData, `/admin/leads?open=${leadId}`), ok: "Booking cancelled", entityId: () => id, revalidate: ["/admin/leads", "/admin/calendar"] });
}
export async function setBookingStatus(formData: FormData) {
  const id = parseNum(formData.get("bookingId")); const status = str(formData.get("status")) as "booked" | "done" | "no_show" | "cancelled";
  await adminAction("calendar", "booking", "update", async () => { await db.update(bookings).set({ status, updatedAt: new Date() }).where(eq(bookings.id, id)); return id; }, { back: backTo(formData, "/admin/calendar"), ok: "Booking updated", entityId: () => id, revalidate: ["/admin/calendar", "/admin/leads"] });
}
export async function deleteBooking(formData: FormData) {
  const id = parseNum(formData.get("bookingId"));
  await adminAction("calendar", "booking", "delete", async () => { await db.delete(bookings).where(eq(bookings.id, id)); return id; }, { back: backTo(formData, "/admin/calendar"), ok: "Booking deleted", entityId: () => id, revalidate: ["/admin/calendar", "/admin/leads"] });
}
