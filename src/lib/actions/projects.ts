"use server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, projects, projectActivity, projectPhases, projectStages, projectFields, invoices, milestones, documents, approvals, portalAccess, leads, leadActivity } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool, slugify } from "@/lib/utils";
import { emitEvent } from "@/lib/server/webhooks";
import { runStageAutomation, nextProjectCode, firstStage } from "@/lib/server/projects";
import { setSetting, getSetting } from "@/lib/server/settings";
import { sendInvoice, markInvoicePaid } from "@/lib/server/stripe";
import { sendEmail } from "@/lib/server/outbox";
import { randomToken } from "@/lib/server/crypto";
import { env } from "@/lib/env";

const AUTOMATIONS = ["none", "request_deposit", "send_invoice", "client_approval", "schedule_install", "request_review"];

async function setProjectStage(projectId: number, stageId: number, userId: number, via: string) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) }); if (!project) throw new Error("Project not found");
  if (project.stageId === stageId) return project;
  const stage = await db.query.projectStages.findFirst({ where: eq(projectStages.id, stageId) }); if (!stage) throw new Error("Stage not found");
  const [updated] = await db.update(projects).set({ stageId, updatedAt: new Date() }).where(eq(projects.id, projectId)).returning();
  await db.insert(projectActivity).values({ projectId, userId, type: "stage", body: `Moved to ${stage.name} (${via})` });
  await emitEvent("project.stage_changed", { projectId, code: project.code, to: stage.name, stageId, via });
  await runStageAutomation(projectId, stageId, userId).catch((e) => db.insert(projectActivity).values({ projectId, userId, type: "automation", body: `Automation failed: ${String(e?.message || e).slice(0, 140)}` }));
  return updated;
}

/** Drag & drop between board columns (no redirect). */
export async function moveProjectStage(projectId: number, stageId: number) {
  const user = await requireArea("projects");
  await setProjectStage(projectId, stageId, user.id, "drag & drop");
  await audit(user.id, "stage", "project", projectId, { stageId });
  revalidatePath("/admin/projects");
  return { ok: true };
}

export async function createProject(formData: FormData) {
  await adminAction("projects", "project", "create", async (user) => {
    const name = str(formData.get("name")); if (!name) throw new Error("Project name is required");
    const leadId = formData.get("leadId") ? parseNum(formData.get("leadId")) : null;
    const lead = leadId ? await db.query.leads.findFirst({ where: eq(leads.id, leadId) }) : null;
    const stage = formData.get("stageId") ? await db.query.projectStages.findFirst({ where: eq(projectStages.id, parseNum(formData.get("stageId"))) }) : await firstStage();
    const value = formData.get("contractValue") ? parseNum(formData.get("contractValue")) : null;
    const [p] = await db.insert(projects).values({
      code: await nextProjectCode(), name, leadId: lead?.id ?? null, leadName: lead?.name || strOrNull(formData.get("leadName")), serviceId: formData.get("serviceId") ? parseNum(formData.get("serviceId")) : null, serviceName: strOrNull(formData.get("serviceName")) || lead?.sourceLabel || null,
      stageId: stage?.id ?? null, ownerId: formData.get("ownerId") ? parseNum(formData.get("ownerId")) : user.id, contractValue: value != null ? String(value) : null, signedAt: strOrNull(formData.get("signedAt")) || new Date().toISOString().slice(0, 10), targetDate: strOrNull(formData.get("targetDate")), address: strOrNull(formData.get("address")) || lead?.address || null, scope: strOrNull(formData.get("scope")), nextMilestone: strOrNull(formData.get("nextMilestone")), answers: lead?.answers || {},
    }).returning();
    await db.insert(projectActivity).values({ projectId: p.id, userId: user.id, type: "system", body: `Project created by ${user.name}` });
    await db.insert(milestones).values({ projectId: p.id, title: "Agreement signed", dueAt: p.signedAt, doneAt: new Date(), sort: 0 });
    if (lead) { await db.update(leads).set({ convertedProjectId: p.id, stage: "won", updatedAt: new Date() }).where(eq(leads.id, lead.id)); await db.insert(leadActivity).values({ leadId: lead.id, userId: user.id, type: "stage", body: `Project ${p.code} created` }); }
    await emitEvent("project.created", { projectId: p.id, code: p.code, leadId: lead?.id ?? null, name: p.name, contractValue: p.contractValue });
    return p;
  }, { back: "/admin/projects", ok: "Project created", entityId: (p) => p.id, revalidate: ["/admin/projects", "/admin/leads"] });
}

export async function updateProject(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("projects", "project", "update", async (user) => {
    const value = str(formData.get("contractValue"));
    const patch: Partial<typeof projects.$inferInsert> = {
      name: str(formData.get("name")) || undefined, ownerId: formData.get("ownerId") ? (str(formData.get("ownerId")) ? parseNum(formData.get("ownerId")) : null) : undefined, contractValue: formData.has("contractValue") ? (value ? String(parseNum(value)) : null) : undefined,
      targetDate: formData.has("targetDate") ? strOrNull(formData.get("targetDate")) : undefined, signedAt: formData.has("signedAt") ? strOrNull(formData.get("signedAt")) : undefined, address: formData.has("address") ? strOrNull(formData.get("address")) : undefined, scope: formData.has("scope") ? strOrNull(formData.get("scope")) : undefined, nextMilestone: formData.has("nextMilestone") ? strOrNull(formData.get("nextMilestone")) : undefined,
      notes: formData.has("notes") ? strOrNull(formData.get("notes")) : undefined, serviceName: formData.has("serviceName") ? strOrNull(formData.get("serviceName")) : undefined, depositPct: formData.has("depositPct") ? Math.min(100, Math.max(0, parseNum(formData.get("depositPct"), 50))) : undefined, clientPortalEnabled: formData.has("portalForm") ? bool(formData.get("clientPortalEnabled")) : undefined, updatedAt: new Date(),
    };
    if (formData.has("status")) { const s = str(formData.get("status")) as "active" | "closed" | "archived"; patch.status = s; patch.closedAt = s === "active" ? null : new Date(); }
    await db.update(projects).set(patch).where(eq(projects.id, id));
    if (formData.get("stageId")) await setProjectStage(id, parseNum(formData.get("stageId")), user.id, "edited");
    return id;
  }, { back: backTo(formData, `/admin/projects?open=${id}`), ok: "Project saved", entityId: () => id, revalidate: ["/admin/projects"] });
}

export async function deleteProject(formData: FormData) {
  const id = parseNum(formData.get("id"));
  await adminAction("projects", "project", "delete", async () => {
    await db.update(leads).set({ convertedProjectId: null }).where(eq(leads.convertedProjectId, id));
    await db.delete(projects).where(eq(projects.id, id)); return id;
  }, { back: "/admin/projects", ok: "Project deleted", entityId: () => id, revalidate: ["/admin/projects", "/admin/leads"] });
}

export async function addProjectNote(formData: FormData) {
  const id = parseNum(formData.get("id")); const body = str(formData.get("body"));
  await adminAction("projects", "project_activity", "create", async (user) => { if (!body) throw new Error("Write something first"); await db.insert(projectActivity).values({ projectId: id, userId: user.id, type: str(formData.get("type")) || "note", body }); return id; }, { back: backTo(formData, `/admin/projects?open=${id}`), ok: "Note saved", entityId: () => id, revalidate: ["/admin/projects"] });
}

// --- Invoices -------------------------------------------------------------
export async function addInvoice(formData: FormData) {
  const projectId = parseNum(formData.get("projectId"));
  await adminAction("projects", "invoice", "create", async () => {
    const label = str(formData.get("label")) || "Invoice"; const amount = parseNum(formData.get("amount")); if (!(amount > 0)) throw new Error("Amount must be greater than zero");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(invoices).where(eq(invoices.projectId, projectId));
    const [inv] = await db.insert(invoices).values({ projectId, label, amount: String(amount), status: "pending", dueAt: strOrNull(formData.get("dueAt")), sort: Number(n) }).returning();
    return inv;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: "Invoice added", entityId: (i) => i.id, revalidate: ["/admin/projects", "/admin/ops"] });
}
export async function invoiceAction(formData: FormData) {
  const id = parseNum(formData.get("invoiceId")); const projectId = parseNum(formData.get("projectId")); const op = str(formData.get("op"));
  await adminAction("projects", "invoice", op, async (user) => {
    if (op === "send") await sendInvoice(id, user.id);
    else if (op === "paid") await markInvoicePaid(id, user.id, "manual");
    else if (op === "void") await db.update(invoices).set({ status: "void", updatedAt: new Date() }).where(eq(invoices.id, id));
    else if (op === "pending") await db.update(invoices).set({ status: "pending", paidAt: null, updatedAt: new Date() }).where(eq(invoices.id, id));
    else if (op === "delete") await db.delete(invoices).where(eq(invoices.id, id));
    else if (op === "update") await db.update(invoices).set({ label: str(formData.get("label")) || undefined, amount: formData.get("amount") ? String(parseNum(formData.get("amount"))) : undefined, dueAt: strOrNull(formData.get("dueAt")), updatedAt: new Date() }).where(eq(invoices.id, id));
    else throw new Error("Unknown operation");
    return id;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: { send: "Invoice sent", paid: "Marked paid", void: "Invoice voided", pending: "Invoice reopened", delete: "Invoice deleted", update: "Invoice updated" }[op] || "Done", entityId: () => id, revalidate: ["/admin/projects", "/admin/ops"] });
}

// --- Milestones -----------------------------------------------------------
export async function addMilestone(formData: FormData) {
  const projectId = parseNum(formData.get("projectId"));
  await adminAction("projects", "milestone", "create", async () => {
    const title = str(formData.get("title")); if (!title) throw new Error("Milestone title is required");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(milestones).where(eq(milestones.projectId, projectId));
    const [m] = await db.insert(milestones).values({ projectId, title, dueAt: strOrNull(formData.get("dueAt")), sort: Number(n), visibleToClient: formData.has("visibleToClient") ? bool(formData.get("visibleToClient")) : true }).returning();
    await db.update(projects).set({ nextMilestone: sql`coalesce(${projects.nextMilestone}, ${title})` }).where(eq(projects.id, projectId));
    return m;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: "Milestone added", entityId: (m) => m.id, revalidate: ["/admin/projects"] });
}
export async function milestoneAction(formData: FormData) {
  const id = parseNum(formData.get("milestoneId")); const projectId = parseNum(formData.get("projectId")); const op = str(formData.get("op"));
  await adminAction("projects", "milestone", op, async (user) => {
    const m = await db.query.milestones.findFirst({ where: eq(milestones.id, id) }); if (!m) throw new Error("Milestone not found");
    if (op === "toggle") { await db.update(milestones).set({ doneAt: m.doneAt ? null : new Date() }).where(eq(milestones.id, id)); if (!m.doneAt) await db.insert(projectActivity).values({ projectId, userId: user.id, type: "milestone", body: `Milestone complete: ${m.title}` }); }
    else if (op === "delete") await db.delete(milestones).where(eq(milestones.id, id));
    else if (op === "visibility") await db.update(milestones).set({ visibleToClient: !m.visibleToClient }).where(eq(milestones.id, id));
    else if (op === "update") await db.update(milestones).set({ title: str(formData.get("title")) || m.title, dueAt: strOrNull(formData.get("dueAt")) }).where(eq(milestones.id, id));
    return id;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: "Milestone updated", entityId: () => id, revalidate: ["/admin/projects"] });
}

// --- Documents ------------------------------------------------------------
export async function attachProjectDocument(formData: FormData) {
  const projectId = parseNum(formData.get("projectId"));
  await adminAction("projects", "document", "create", async (user) => {
    const file = formData.get("file"); const name = str(formData.get("name"));
    let url = str(formData.get("url")); let key: string | null = null; let size: number | null = null;
    if (file instanceof File && file.size > 0) { const { putObject } = await import("@/lib/server/storage"); const r = await putObject(`projects/${projectId}/${Date.now()}-${file.name}`, Buffer.from(await file.arrayBuffer())); url = r.url; key = r.key; size = file.size; }
    if (!url) throw new Error("Attach a file or a link");
    const [d] = await db.insert(documents).values({ projectId, name: name || (file instanceof File ? file.name : "Document"), url, storageKey: key, size, type: str(formData.get("type")) || "other", visibleToClient: formData.has("visibleToClient") ? bool(formData.get("visibleToClient")) : true, uploadedBy: user.id }).returning();
    await db.insert(projectActivity).values({ projectId, userId: user.id, type: "document", body: `Attached ${d.name}` });
    return d;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: "Document attached", entityId: (d) => d.id, revalidate: ["/admin/projects"] });
}
export async function documentAction(formData: FormData) {
  const id = parseNum(formData.get("documentId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/projects");
  await adminAction("projects", "document", op, async () => {
    const d = await db.query.documents.findFirst({ where: eq(documents.id, id) }); if (!d) throw new Error("Document not found");
    if (op === "delete") { if (d.storageKey) { const { deleteObject } = await import("@/lib/server/storage"); await deleteObject(d.storageKey).catch(() => {}); } await db.delete(documents).where(eq(documents.id, id)); }
    else if (op === "visibility") await db.update(documents).set({ visibleToClient: !d.visibleToClient }).where(eq(documents.id, id));
    else if (op === "rename") await db.update(documents).set({ name: str(formData.get("name")) || d.name, type: str(formData.get("type")) || d.type }).where(eq(documents.id, id));
    return id;
  }, { back, ok: op === "delete" ? "Document removed" : "Document updated", entityId: () => id, revalidate: ["/admin/projects", "/admin/leads"] });
}

// --- Approvals & portal ---------------------------------------------------
export async function requestApproval(formData: FormData) {
  const projectId = parseNum(formData.get("projectId"));
  await adminAction("projects", "approval", "create", async (user) => {
    const title = str(formData.get("title")); if (!title) throw new Error("Title is required");
    const [a] = await db.insert(approvals).values({ projectId, title, description: strOrNull(formData.get("description")) }).returning();
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    const lead = project?.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, project.leadId) }) : null;
    if (lead?.email && project) { const pa = await db.query.portalAccess.findFirst({ where: eq(portalAccess.projectId, projectId) }); const link = pa ? `${env.baseUrl}/portal/${pa.token}` : `${env.baseUrl}/contact`; await sendEmail({ to: lead.email, subject: `Your approval is needed — ${project.name}`, relatedType: "project", relatedId: projectId, text: `Hi ${lead.name.split(" ")[0]},\n\n${title}\n${a.description || ""}\n\nReview and respond here: ${link}\n\nGrace In Design` }); }
    await db.insert(projectActivity).values({ projectId, userId: user.id, type: "approval", body: `Approval requested: ${title}` });
    return a;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: "Approval requested", entityId: (a) => a.id, revalidate: ["/admin/projects", "/admin/ops"] });
}
export async function approvalAction(formData: FormData) {
  const id = parseNum(formData.get("approvalId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/ops");
  await adminAction("projects", "approval", op, async () => {
    if (op === "delete") await db.delete(approvals).where(eq(approvals.id, id));
    else if (op === "approve" || op === "changes") await db.update(approvals).set({ status: op === "approve" ? "approved" : "changes_requested", respondedAt: new Date(), responseNote: strOrNull(formData.get("note")) || "Recorded by admin" }).where(eq(approvals.id, id));
    else if (op === "reopen") await db.update(approvals).set({ status: "pending", respondedAt: null, responseNote: null }).where(eq(approvals.id, id));
    return id;
  }, { back, ok: "Approval updated", entityId: () => id, revalidate: ["/admin/projects", "/admin/ops"] });
}
export async function portalAction(formData: FormData) {
  const projectId = parseNum(formData.get("projectId")); const op = str(formData.get("op"));
  await adminAction("projects", "portal_access", op, async (user) => {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) }); if (!project) throw new Error("Project not found");
    const lead = project.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, project.leadId) }) : null;
    const email = str(formData.get("email")) || lead?.email || "";
    if (op === "revoke") { await db.delete(portalAccess).where(eq(portalAccess.projectId, projectId)); return projectId; }
    if (!email) throw new Error("Enter the client's email");
    await db.delete(portalAccess).where(eq(portalAccess.projectId, projectId));
    const token = randomToken(18);
    await db.insert(portalAccess).values({ projectId, email, token });
    if (op === "send") await sendEmail({ to: email, subject: `Your client portal — ${project.name}`, relatedType: "project", relatedId: projectId, text: `Hi ${(lead?.name || "there").split(" ")[0]},\n\nHere is your private link to the ${project.name} client portal (documents, schedule, invoices and approvals):\n${env.baseUrl}/portal/${token}\n\nKeep this link private — anyone with it can view your project.\n\nGrace In Design` });
    await db.insert(projectActivity).values({ projectId, userId: user.id, type: "portal", body: op === "send" ? `Portal link sent to ${email}` : "Portal link regenerated" });
    return projectId;
  }, { back: backTo(formData, `/admin/projects?open=${projectId}`), ok: op === "revoke" ? "Portal access revoked" : op === "send" ? "Portal link sent" : "Portal link regenerated", entityId: () => projectId, revalidate: ["/admin/projects"] });
}

// --- Phases & stages ------------------------------------------------------
export async function addPhase(formData: FormData) {
  await adminAction("projects", "project_phase", "create", async () => {
    const name = str(formData.get("name")); if (!name) throw new Error("Phase name is required");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(projectPhases);
    const [ph] = await db.insert(projectPhases).values({ name, color: str(formData.get("color")) || "#6cb6e6", sort: Number(n) }).returning();
    await db.insert(projectStages).values({ phaseId: ph.id, name: str(formData.get("firstStage")) || "New stage", sort: 0 });
    return ph;
  }, { back: "/admin/projects?view=config", ok: "Phase added", entityId: (p) => p.id, revalidate: ["/admin/projects"] });
}
export async function updatePhase(formData: FormData) {
  const id = parseNum(formData.get("phaseId"));
  await adminAction("projects", "project_phase", "update", async () => { await db.update(projectPhases).set({ name: str(formData.get("name")) || undefined, color: str(formData.get("color")) || undefined }).where(eq(projectPhases.id, id)); return id; }, { back: "/admin/projects?view=config", ok: "Phase saved", entityId: () => id, revalidate: ["/admin/projects"] });
}
export async function deletePhase(formData: FormData) {
  const id = parseNum(formData.get("phaseId"));
  await adminAction("projects", "project_phase", "delete", async () => {
    const stages = await db.select({ id: projectStages.id }).from(projectStages).where(eq(projectStages.phaseId, id));
    if (stages.length) { const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(projects).where(sql`${projects.stageId} in ${sql.raw(`(${stages.map((s) => s.id).join(",")})`)}`); if (Number(n) > 0) throw new Error(`${n} project(s) sit in this phase — move them first`); }
    await db.delete(projectPhases).where(eq(projectPhases.id, id)); return id;
  }, { back: "/admin/projects?view=config", ok: "Phase removed", entityId: () => id, revalidate: ["/admin/projects"] });
}
export async function addStage(formData: FormData) {
  const phaseId = parseNum(formData.get("phaseId"));
  await adminAction("projects", "project_stage", "create", async () => {
    const name = str(formData.get("name")) || "New stage";
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(projectStages).where(eq(projectStages.phaseId, phaseId));
    const [s] = await db.insert(projectStages).values({ phaseId, name, sort: Number(n), automation: AUTOMATIONS.includes(str(formData.get("automation"))) ? str(formData.get("automation")) : "none" }).returning();
    return s;
  }, { back: "/admin/projects?view=config", ok: "Stage added", entityId: (s) => s.id, revalidate: ["/admin/projects"] });
}
export async function updateStage(formData: FormData) {
  const id = parseNum(formData.get("stageId"));
  await adminAction("projects", "project_stage", "update", async () => {
    const automation = str(formData.get("automation"));
    await db.update(projectStages).set({ name: str(formData.get("name")) || undefined, automation: AUTOMATIONS.includes(automation) ? automation : undefined }).where(eq(projectStages.id, id)); return id;
  }, { back: "/admin/projects?view=config", ok: "Stage saved", entityId: () => id, revalidate: ["/admin/projects"] });
}
export async function deleteStage(formData: FormData) {
  const id = parseNum(formData.get("stageId")); const moveTo = formData.get("moveTo") ? parseNum(formData.get("moveTo")) : null;
  await adminAction("projects", "project_stage", "delete", async () => {
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(projects).where(eq(projects.stageId, id));
    if (Number(n) > 0) { if (!moveTo || moveTo === id) throw new Error(`${n} project(s) are in this stage — pick a stage to move them to`); await db.update(projects).set({ stageId: moveTo }).where(eq(projects.stageId, id)); }
    await db.delete(projectStages).where(eq(projectStages.id, id)); return id;
  }, { back: "/admin/projects?view=config", ok: "Stage removed", entityId: () => id, revalidate: ["/admin/projects"] });
}
/** Reorder stages inside a phase (or move a stage into another phase) — called from the drag & drop list. */
export async function reorderStages(phaseId: number, ids: number[]) {
  const user = await requireArea("projects");
  for (const [i, id] of ids.entries()) await db.update(projectStages).set({ sort: i, phaseId }).where(eq(projectStages.id, id));
  await audit(user.id, "reorder", "project_stage", phaseId, { ids });
  revalidatePath("/admin/projects"); return { ok: true };
}
export async function reorderPhases(ids: number[]) {
  const user = await requireArea("projects");
  for (const [i, id] of ids.entries()) await db.update(projectPhases).set({ sort: i }).where(eq(projectPhases.id, id));
  await audit(user.id, "reorder", "project_phase", null, { ids });
  revalidatePath("/admin/projects"); return { ok: true };
}

// --- Project fields & conversion rules ------------------------------------
export async function addProjectField(formData: FormData) {
  await adminAction("projects", "project_field", "create", async () => {
    const label = str(formData.get("label")); if (!label) throw new Error("Label is required");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(projectFields);
    const key = slugify(label).replace(/-/g, "_") || `field_${Date.now()}`;
    const [f] = await db.insert(projectFields).values({ key: `${key}_${Math.random().toString(36).slice(2, 6)}`, label, type: str(formData.get("type")) || "text", sort: Number(n) }).returning();
    return f;
  }, { back: "/admin/projects?view=config", ok: "Field added", entityId: (f) => f.id, revalidate: ["/admin/projects"] });
}
export async function projectFieldAction(formData: FormData) {
  const id = parseNum(formData.get("fieldId")); const op = str(formData.get("op"));
  await adminAction("projects", "project_field", op, async () => {
    if (op === "delete") await db.delete(projectFields).where(eq(projectFields.id, id));
    else if (op === "toggle") await db.update(projectFields).set({ enabled: sql`not ${projectFields.enabled}` }).where(eq(projectFields.id, id));
    else if (op === "update") await db.update(projectFields).set({ label: str(formData.get("label")) || undefined, type: str(formData.get("type")) || undefined }).where(eq(projectFields.id, id));
    return id;
  }, { back: "/admin/projects?view=config", ok: "Field updated", entityId: () => id, revalidate: ["/admin/projects"] });
}
export async function saveConversionRules(formData: FormData) {
  await adminAction("projects", "setting", "update", async () => {
    const cur = await getSetting("conversion_rules");
    const next = { ...cur, createProjectOnSigned: bool(formData.get("createProjectOnSigned")), moveLeadToWon: bool(formData.get("moveLeadToWon")), copyAnswers: bool(formData.get("copyAnswers")), requestDepositInvoice: bool(formData.get("requestDepositInvoice")), sendWelcomeEmail: bool(formData.get("sendWelcomeEmail")) };
    await setSetting("conversion_rules", next); return "conversion_rules";
  }, { back: "/admin/projects?view=config", ok: "Conversion rules saved", entityId: (k) => k, revalidate: ["/admin/projects", "/admin/leads"] });
}
