"use server";
import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leads, leadActivity, leadStages, bookings, documents, isCoreLeadStage, type LeadStage } from "@/lib/db";
import { requireArea, requireOwner } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum } from "@/lib/utils";
import { emitEvent } from "@/lib/server/webhooks";
import { convertLeadToProject } from "@/lib/server/projects";
import { enrollLeadInSequences, stopSequencesForLead } from "@/lib/server/sequences";
import { sendEmail, sendSms } from "@/lib/server/outbox";
import { publicLead } from "@/lib/server/consult";
import { syncLeadToHubspot } from "@/lib/server/hubspot";
import { isLeadStage, stageLabel, stageKeyFor } from "@/lib/server/lead-stages";

async function setStage(leadId: number, stage: LeadStage, userId: number, via: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!lead) throw new Error("Lead not found");
  if (lead.stage === stage) return lead;
  const [updated] = await db.update(leads).set({ stage, stageChangedAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, leadId)).returning();
  const col = await db.query.leadStages.findFirst({ where: eq(leadStages.key, stage) }); const label = col?.label || (await stageLabel(stage));
  const purge = col?.autoDeleteDays ? ` — deleted automatically after ${col.autoDeleteDays} day${col.autoDeleteDays === 1 ? "" : "s"} unless moved out` : "";
  await db.insert(leadActivity).values({ leadId, userId, type: "stage", body: `Moved to ${label} (${via})${purge}` });
  await emitEvent("lead.stage_changed", { lead: publicLead(updated), from: lead.stage, to: stage, via });
  if (stage === "won" || stage === "lost") await stopSequencesForLead(leadId); else await enrollLeadInSequences(leadId, stage).catch(() => {});
  void syncLeadToHubspot(leadId).catch(() => {});
  return updated;
}

/** Drag & drop between board columns (no redirect). */
export async function moveLeadStage(leadId: number, stage: LeadStage) {
  const user = await requireArea("leads");
  if (!(await isLeadStage(stage))) return { ok: false, error: "bad stage" };
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
    if (stage && (await isLeadStage(stage))) await setStage(id, stage, user.id, "edited");
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

// --- Board columns (lead_stages) -------------------------------------------
const COLUMNS_BACK = "/admin/leads?view=columns";
const HEX = /^#[0-9a-f]{3,8}$/i;
/** The colour picker posts "bg|fg" from STAGE_PALETTE. */
const colorsFrom = (formData: FormData) => { const [bg, fg] = str(formData.get("color")).split("|"); return HEX.test(bg || "") && HEX.test(fg || "") ? { bg, fg } : null; };
const days = (v: FormDataEntryValue | null) => { const n = Math.round(Number(String(v ?? "").trim())); return Number.isFinite(n) && n > 0 ? Math.min(n, 3650) : null; };

export async function addLeadColumn(formData: FormData) {
  await adminAction("leads", "lead_stage", "create", async () => {
    await requireOwner();
    const label = str(formData.get("label")); if (!label) throw new Error("Give the column a name");
    const existing = await db.select({ key: leadStages.key, label: leadStages.label }).from(leadStages);
    if (existing.some((c) => c.label.toLowerCase() === label.toLowerCase())) throw new Error(`There is already a “${label}” column`);
    const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${leadStages.sort}), -1) + 1` }).from(leadStages);
    const colors = colorsFrom(formData) || { bg: "#f2f4f7", fg: "#4b5569" };
    const [row] = await db.insert(leadStages).values({ key: stageKeyFor(label, existing.map((c) => c.key)), label, sort: Number(n), ...colors, autoDeleteDays: formData.get("autoDelete") === "1" ? days(formData.get("autoDeleteDays")) : null }).returning();
    return row;
  }, { back: COLUMNS_BACK, ok: (r) => `“${r.label}” column added`, entityId: (r) => r.key, revalidate: ["/admin/leads", "/admin/ops"] });
}

export async function updateLeadColumn(formData: FormData) {
  const key = str(formData.get("key"));
  await adminAction("leads", "lead_stage", "update", async () => {
    await requireOwner();
    const label = str(formData.get("label")); if (!label) throw new Error("A column needs a name");
    const colors = colorsFrom(formData);
    const autoDeleteDays = formData.get("autoDelete") === "1" ? days(formData.get("autoDeleteDays")) : null;
    if (autoDeleteDays && isCoreLeadStage(key)) throw new Error("Auto-delete is only for columns you add (like Trash) — built-in columns drive automation");
    const [row] = await db.update(leadStages).set({ label, ...(colors || {}), autoDeleteDays }).where(eq(leadStages.key, key)).returning();
    if (!row) throw new Error("Column not found");
    return row;
  }, { back: COLUMNS_BACK, ok: (r) => `“${r.label}” saved`, entityId: () => key, revalidate: ["/admin/leads", "/admin/ops"] });
}

export async function deleteLeadColumn(formData: FormData) {
  const key = str(formData.get("key")); const moveTo = str(formData.get("moveTo"));
  await adminAction("leads", "lead_stage", "delete", async (user) => {
    await requireOwner();
    if (isCoreLeadStage(key)) throw new Error("Built-in columns can be renamed but not removed");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.stage, key));
    if (Number(n) > 0) {
      if (!moveTo || moveTo === key || !(await isLeadStage(moveTo))) throw new Error(`${n} lead(s) are in this column — pick a column to move them to`);
      const moving = await db.select({ id: leads.id }).from(leads).where(eq(leads.stage, key));
      for (const l of moving) await setStage(l.id, moveTo, user.id, "column removed");
    }
    await db.delete(leadStages).where(eq(leadStages.key, key));
    return key;
  }, { back: COLUMNS_BACK, ok: "Column removed", entityId: (k) => k, revalidate: ["/admin/leads", "/admin/ops"] });
}

/** Move a column one place left (-1) or right (+1). */
export async function moveLeadColumn(formData: FormData) {
  const key = str(formData.get("key")); const dir = Number(formData.get("dir")) < 0 ? -1 : 1;
  await adminAction("leads", "lead_stage", "reorder", async () => {
    await requireOwner();
    const cols = await db.select({ key: leadStages.key }).from(leadStages).orderBy(asc(leadStages.sort), asc(leadStages.createdAt));
    const i = cols.findIndex((c) => c.key === key); const j = i + dir;
    if (i < 0 || j < 0 || j >= cols.length) return key;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    for (const [idx, c] of cols.entries()) await db.update(leadStages).set({ sort: idx }).where(eq(leadStages.key, c.key));
    return key;
  }, { back: COLUMNS_BACK, ok: "Order saved", entityId: (k) => k, revalidate: ["/admin/leads"] });
}
