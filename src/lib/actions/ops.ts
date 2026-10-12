"use server";
/** Phase 4 — drips, SMS templates, proposals, webhooks, outbox, scheduled jobs, HubSpot. */
import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, emailSequences, emailSequenceSteps, sequenceEnrollments, smsTemplates, proposals, leads, leadActivity, webhookSubscriptions, webhookDeliveries, outbox, LEAD_STAGES, type LeadStage } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool } from "@/lib/utils";
import { sendSms, deliverOutbox } from "@/lib/server/outbox";
import { renderTemplate, enrollLeadInSequences } from "@/lib/server/sequences";
import { sendProposal } from "@/lib/server/esign";
import { emitEvent, deliver, GID_EVENTS, isSafeUrl, type GidEvent } from "@/lib/server/webhooks";
import { encrypt, randomToken } from "@/lib/server/crypto";
import { runJob, JOBS, type Job } from "@/lib/server/cron";
import { runHubspotSync, syncLeadToHubspot, syncProjectToHubspot } from "@/lib/server/hubspot";

const OPS = "/admin/ops";
const tab = (t: string) => `${OPS}?tab=${t}`;

// --- Sequences --------------------------------------------------------------
export async function saveSequence(formData: FormData) {
  const id = formData.get("sequenceId") ? parseNum(formData.get("sequenceId")) : null;
  await adminAction("ops", "email_sequence", id ? "update" : "create", async () => {
    const name = str(formData.get("name")); if (!name) throw new Error("Name is required");
    const stage = str(formData.get("triggerStage")); const triggerStage = (LEAD_STAGES as readonly string[]).includes(stage) ? (stage as LeadStage) : null;
    const values = { name, triggerPathId: strOrNull(formData.get("triggerPathId")), triggerStage, isActive: formData.has("isActive") ? bool(formData.get("isActive")) : true, updatedAt: new Date() };
    if (id) { await db.update(emailSequences).set(values).where(eq(emailSequences.id, id)); return id; }
    const [s] = await db.insert(emailSequences).values(values).returning();
    await db.insert(emailSequenceSteps).values({ sequenceId: s.id, sort: 0, delayHours: 24, channel: "email", subject: "Thanks for reaching out, {{first_name}}", body: "Hi {{first_name}},\n\nThank you for telling us about your project. Here's what happens next…\n\nGrace" });
    return s.id;
  }, { back: tab("sequences"), ok: "Sequence saved", entityId: (k) => k, revalidate: [OPS] });
}
export async function sequenceAction(formData: FormData) {
  const id = parseNum(formData.get("sequenceId")); const op = str(formData.get("op"));
  await adminAction("ops", "email_sequence", op, async () => {
    if (op === "delete") await db.delete(emailSequences).where(eq(emailSequences.id, id));
    else if (op === "toggle") await db.update(emailSequences).set({ isActive: sql`not ${emailSequences.isActive}` }).where(eq(emailSequences.id, id));
    else if (op === "enroll") { const leadId = parseNum(formData.get("leadId")); const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!lead) throw new Error("Pick a lead"); const steps = await db.select().from(emailSequenceSteps).where(eq(emailSequenceSteps.sequenceId, id)).orderBy(asc(emailSequenceSteps.sort)); if (!steps.length) throw new Error("Add a step first"); await db.insert(sequenceEnrollments).values({ sequenceId: id, leadId, nextSendAt: new Date(Date.now() + steps[0].delayHours * 3600000) }).onConflictDoUpdate({ target: [sequenceEnrollments.sequenceId, sequenceEnrollments.leadId], set: { status: "active", currentStep: 0, nextSendAt: new Date(Date.now() + steps[0].delayHours * 3600000) } }); }
    return id;
  }, { back: tab("sequences"), ok: op === "delete" ? "Sequence deleted" : op === "enroll" ? "Lead enrolled" : "Sequence updated", entityId: () => id, revalidate: [OPS] });
}
export async function saveSequenceStep(formData: FormData) {
  const sequenceId = parseNum(formData.get("sequenceId")); const id = formData.get("stepId") ? parseNum(formData.get("stepId")) : null;
  await adminAction("ops", "email_sequence_step", id ? "update" : "create", async () => {
    const body = str(formData.get("body")); if (!body) throw new Error("Message body is required");
    const values = { delayHours: Math.max(0, parseNum(formData.get("delayHours"), 24)), channel: str(formData.get("channel")) === "sms" ? "sms" : "email", subject: strOrNull(formData.get("subject")), body };
    if (id) { await db.update(emailSequenceSteps).set(values).where(eq(emailSequenceSteps.id, id)); return id; }
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(emailSequenceSteps).where(eq(emailSequenceSteps.sequenceId, sequenceId));
    const [s] = await db.insert(emailSequenceSteps).values({ ...values, sequenceId, sort: Number(n) }).returning(); return s.id;
  }, { back: tab("sequences"), ok: "Step saved", entityId: (k) => k, revalidate: [OPS] });
}
export async function deleteSequenceStep(formData: FormData) {
  const id = parseNum(formData.get("stepId"));
  await adminAction("ops", "email_sequence_step", "delete", async () => { await db.delete(emailSequenceSteps).where(eq(emailSequenceSteps.id, id)); return id; }, { back: tab("sequences"), ok: "Step removed", entityId: () => id, revalidate: [OPS] });
}
export async function reorderSteps(sequenceId: number, ids: number[]) {
  const user = await requireArea("ops");
  for (const [i, id] of ids.entries()) await db.update(emailSequenceSteps).set({ sort: i }).where(and(eq(emailSequenceSteps.id, id), eq(emailSequenceSteps.sequenceId, sequenceId)));
  await audit(user.id, "reorder", "email_sequence_step", sequenceId, { ids }); revalidatePath(OPS); return { ok: true };
}
export async function enrollmentAction(formData: FormData) {
  const id = parseNum(formData.get("enrollmentId")); const op = str(formData.get("op"));
  await adminAction("ops", "sequence_enrollment", op, async () => { if (op === "stop") await db.update(sequenceEnrollments).set({ status: "stopped" }).where(eq(sequenceEnrollments.id, id)); else if (op === "delete") await db.delete(sequenceEnrollments).where(eq(sequenceEnrollments.id, id)); else if (op === "resume") await db.update(sequenceEnrollments).set({ status: "active", nextSendAt: new Date() }).where(eq(sequenceEnrollments.id, id)); return id; }, { back: tab("sequences"), ok: "Enrollment updated", entityId: () => id, revalidate: [OPS] });
}
export async function enrollMatchingLeads(_formData: FormData) {
  await adminAction("ops", "sequence_enrollment", "backfill", async () => { const rows = await db.select({ id: leads.id, stage: leads.stage }).from(leads).where(eq(leads.archived, false)); let n = 0; for (const l of rows) n += await enrollLeadInSequences(l.id, l.stage); return n; }, { back: tab("sequences"), ok: "Matching leads enrolled", entityId: (n) => n, revalidate: [OPS] });
}

// --- SMS templates --------------------------------------------------------------
export async function saveSmsTemplate(formData: FormData) {
  const id = formData.get("templateId") ? parseNum(formData.get("templateId")) : null;
  await adminAction("ops", "sms_template", id ? "update" : "create", async () => {
    const body = str(formData.get("body")); const name = str(formData.get("name")); if (!name || !body) throw new Error("Name and message are required");
    if (body.length > 320) throw new Error("Keep SMS under 320 characters (2 segments)");
    const values = { name, category: str(formData.get("category")) || "Follow-up", body, updatedAt: new Date() };
    if (id) { await db.update(smsTemplates).set(values).where(eq(smsTemplates.id, id)); return id; }
    const [t] = await db.insert(smsTemplates).values(values).returning(); return t.id;
  }, { back: tab("sms"), ok: "Template saved", entityId: (k) => k, revalidate: [OPS] });
}
export async function smsTemplateAction(formData: FormData) {
  const id = parseNum(formData.get("templateId")); const op = str(formData.get("op"));
  await adminAction("ops", "sms_template", op, async (user) => {
    const t = await db.query.smsTemplates.findFirst({ where: eq(smsTemplates.id, id) }); if (!t) throw new Error("Template not found");
    if (op === "delete") await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
    else if (op === "send") { const lead = await db.query.leads.findFirst({ where: eq(leads.id, parseNum(formData.get("leadId"))) }); if (!lead?.phone) throw new Error("That lead has no phone number"); const body = renderTemplate(t.body, lead, { consult_type: "consultation", when: "your scheduled time", time: "your scheduled time" }); await sendSms({ to: lead.phone, body, relatedType: "lead", relatedId: lead.id }); await db.insert(leadActivity).values({ leadId: lead.id, userId: user.id, type: "sms", body: `SMS sent (${t.name}): ${body}` }); }
    return id;
  }, { back: tab("sms"), ok: op === "delete" ? "Template deleted" : "Text sent (see outbox)", entityId: () => id, revalidate: [OPS, "/admin/leads"] });
}

// --- Proposals -------------------------------------------------------------------
export async function saveProposal(formData: FormData) {
  const id = formData.get("proposalId") ? parseNum(formData.get("proposalId")) : null; const intent = str(formData.get("intent"));
  let newId = id;
  await adminAction("ops", "proposal", id ? "update" : "create", async (user) => {
    const title = str(formData.get("title")); const body = str(formData.get("body")); if (!title || !body) throw new Error("Title and body are required");
    const leadId = formData.get("leadId") ? parseNum(formData.get("leadId")) : null; const projectId = formData.get("projectId") ? parseNum(formData.get("projectId")) : null;
    const lead = leadId ? await db.query.leads.findFirst({ where: eq(leads.id, leadId) }) : null;
    const values = { title, body, amount: formData.get("amount") ? String(parseNum(formData.get("amount"))) : null, leadId: lead?.id ?? null, projectId, recipientEmail: strOrNull(formData.get("recipientEmail")) || lead?.email || null, recipientName: strOrNull(formData.get("recipientName")) || lead?.name || null, updatedAt: new Date() };
    let row;
    if (id) [row] = await db.update(proposals).set(values).where(eq(proposals.id, id)).returning();
    else [row] = await db.insert(proposals).values({ ...values, token: randomToken(24), createdBy: user.id }).returning();
    newId = row.id;
    if (intent === "send") await sendProposal(row.id, user.id);
    return row.id;
  }, { back: tab("proposals") + (newId ? `&open=${newId}` : ""), ok: intent === "send" ? "Proposal sent for signature" : "Proposal saved", entityId: (k) => k, revalidate: [OPS, "/admin/leads"] });
}
export async function proposalAction(formData: FormData) {
  const id = parseNum(formData.get("proposalId")); const op = str(formData.get("op"));
  await adminAction("ops", "proposal", op, async (user) => {
    const p = await db.query.proposals.findFirst({ where: eq(proposals.id, id) }); if (!p) throw new Error("Proposal not found");
    if (op === "send") await sendProposal(id, user.id);
    else if (op === "delete") await db.delete(proposals).where(eq(proposals.id, id));
    else if (op === "decline") await db.update(proposals).set({ status: "declined", updatedAt: new Date() }).where(eq(proposals.id, id));
    else if (op === "reopen") await db.update(proposals).set({ status: "draft", signedAt: null, signerName: null, signatureData: null, updatedAt: new Date() }).where(eq(proposals.id, id));
    else if (op === "signed_offline") { await db.update(proposals).set({ status: "signed", signedAt: new Date(), signerName: str(formData.get("signerName")) || p.recipientName || "Client", esignProvider: "offline", updatedAt: new Date() }).where(eq(proposals.id, id)); if (p.leadId) await db.insert(leadActivity).values({ leadId: p.leadId, userId: user.id, type: "proposal", body: `Proposal signed offline: ${p.title}` }); await emitEvent("proposal.signed", { proposalId: id, leadId: p.leadId, projectId: p.projectId, amount: p.amount, signerName: str(formData.get("signerName")) || "Client", offline: true }); }
    return id;
  }, { back: tab("proposals"), ok: { send: "Proposal sent", delete: "Proposal deleted", decline: "Marked declined", reopen: "Reopened as draft", signed_offline: "Marked signed" }[op] || "Done", entityId: () => id, revalidate: [OPS, "/admin/leads"] });
}

// --- Webhooks ---------------------------------------------------------------------
export async function saveWebhook(formData: FormData) {
  const id = formData.get("webhookId") ? parseNum(formData.get("webhookId")) : null;
  let shown: string | null = null;
  await adminAction("ops", "webhook_subscription", id ? "update" : "create", async (user) => {
    const url = str(formData.get("url")); if (!isSafeUrl(url)) throw new Error("Enter a public https:// URL");
    const events = formData.getAll("events").map(String).filter((e) => e === "*" || (GID_EVENTS as string[]).includes(e)); if (!events.length) throw new Error("Pick at least one event");
    const values = { name: str(formData.get("name")) || new URL(url).hostname, url, events, updatedAt: new Date() };
    if (id) { await db.update(webhookSubscriptions).set(values).where(eq(webhookSubscriptions.id, id)); return id; }
    const secret = `whsec_${randomToken(24)}`; shown = secret;
    const [w] = await db.insert(webhookSubscriptions).values({ ...values, secretEnc: encrypt(secret), createdBy: user.id }).returning(); return w.id;
  }, { back: tab("webhooks"), ok: shown ? `Webhook added. Signing secret (shown once): ${shown}` : "Webhook saved", entityId: (k) => k, revalidate: [OPS] });
}
export async function webhookAction(formData: FormData) {
  const id = parseNum(formData.get("webhookId")); const op = str(formData.get("op"));
  let shown: string | null = null;
  await adminAction("ops", "webhook_subscription", op, async () => {
    if (op === "delete") await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));
    else if (op === "toggle") await db.update(webhookSubscriptions).set({ isActive: sql`not ${webhookSubscriptions.isActive}` }).where(eq(webhookSubscriptions.id, id));
    else if (op === "rotate") { const secret = `whsec_${randomToken(24)}`; shown = secret; await db.update(webhookSubscriptions).set({ secretEnc: encrypt(secret), updatedAt: new Date() }).where(eq(webhookSubscriptions.id, id)); }
    else if (op === "test") { const [d] = await db.insert(webhookDeliveries).values({ subscriptionId: id, event: "ping", payload: { event: "ping", sentAt: new Date().toISOString(), data: { hello: "from Grace In Design" } }, status: "pending", nextRetryAt: new Date() }).returning(); await deliver(d.id); const r = await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, d.id) }); if (r?.status !== "delivered") throw new Error(`Ping failed: ${r?.lastError || "no response"}`); }
    return id;
  }, { back: tab("webhooks"), ok: shown ? `New signing secret (shown once): ${shown}` : { delete: "Webhook removed", toggle: "Webhook updated", test: "Ping delivered" }[op] || "Done", entityId: () => id, revalidate: [OPS] });
}
export async function deliveryAction(formData: FormData) {
  const id = parseNum(formData.get("deliveryId")); const op = str(formData.get("op"));
  await adminAction("ops", "webhook_delivery", op, async () => { if (op === "retry") { await db.update(webhookDeliveries).set({ status: "pending", attempts: 0, nextRetryAt: new Date() }).where(eq(webhookDeliveries.id, id)); await deliver(id); } else if (op === "delete") await db.delete(webhookDeliveries).where(eq(webhookDeliveries.id, id)); return id; }, { back: tab("webhooks"), ok: op === "retry" ? "Retried" : "Deleted", entityId: () => id, revalidate: [OPS] });
}
export async function emitTestEvent(formData: FormData) {
  await adminAction("ops", "webhook_event", "emit_test", async (user) => { const ev = str(formData.get("event")) as GidEvent; if (!(GID_EVENTS as string[]).includes(ev)) throw new Error("Unknown event"); await emitEvent(ev, { test: true, by: user.email, at: new Date().toISOString() }); return ev; }, { back: tab("webhooks"), ok: "Test event emitted to matching subscriptions", entityId: (k) => k, revalidate: [OPS] });
}

// --- Outbox / jobs / HubSpot ----------------------------------------------------------
export async function outboxAction(formData: FormData) {
  const id = parseNum(formData.get("outboxId")); const op = str(formData.get("op"));
  await adminAction("ops", "outbox", op, async () => { if (op === "retry") { await db.update(outbox).set({ status: "queued", error: null }).where(eq(outbox.id, id)); const r = await deliverOutbox(id); if (r?.status === "failed") throw new Error(`Still failing: ${(r as { error?: string }).error || "unknown"}`); } else if (op === "delete") await db.delete(outbox).where(eq(outbox.id, id)); return id; }, { back: backTo(formData, tab("outbox")), ok: op === "retry" ? "Re-sent" : "Deleted", entityId: () => id, revalidate: [OPS] });
}
export async function purgeOutbox(_formData: FormData) {
  await adminAction("ops", "outbox", "purge", async () => { const r = await db.delete(outbox).where(sql`${outbox.createdAt} < now() - interval '30 days'`).returning({ id: outbox.id }); return r.length; }, { back: tab("outbox"), ok: "Messages older than 30 days removed", entityId: (n) => n, revalidate: [OPS] });
}
export async function runCronJob(formData: FormData) {
  const job = str(formData.get("job")) as Job;
  await adminAction("ops", "cron", job, async () => { if (!JOBS.includes(job)) throw new Error("Unknown job"); return runJob(job); }, { back: tab("jobs"), ok: `Job “${job}” finished — see the log below`, entityId: () => job, revalidate: [OPS, "/admin"] });
}
export async function hubspotSyncNow(formData: FormData) {
  const kind = str(formData.get("kind"));
  await adminAction("ops", "hubspot", "sync", async () => { if (kind === "lead") return syncLeadToHubspot(parseNum(formData.get("id"))); if (kind === "project") return syncProjectToHubspot(parseNum(formData.get("id"))); return runHubspotSync(); }, { back: tab("jobs"), ok: "HubSpot sync finished", revalidate: [OPS] });
}
