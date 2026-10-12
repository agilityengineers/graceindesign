// server-only (also used by scripts/cron.ts)
/** Phase 4 — email/SMS drip sequences triggered by path + stage. */
import { and, eq, lte, or, isNull } from "drizzle-orm";
import { db, emailSequences, emailSequenceSteps, sequenceEnrollments, leads, leadActivity, type LeadStage } from "@/lib/db";
import { sendEmail, sendSms } from "@/lib/server/outbox";
import { env } from "@/lib/env";

export async function enrollLeadInSequences(leadId: number, stage: LeadStage) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) return 0;
  const seqs = await db.select().from(emailSequences).where(and(eq(emailSequences.isActive, true), eq(emailSequences.triggerStage, stage)));
  let n = 0;
  for (const s of seqs) {
    if (s.triggerPathId && s.triggerPathId !== lead.pathId) continue;
    const steps = await db.select().from(emailSequenceSteps).where(eq(emailSequenceSteps.sequenceId, s.id)).orderBy(emailSequenceSteps.sort);
    if (!steps.length) continue;
    await db.insert(sequenceEnrollments).values({ sequenceId: s.id, leadId, currentStep: 0, nextSendAt: new Date(Date.now() + steps[0].delayHours * 3600000), status: "active" }).onConflictDoNothing();
    n++;
  }
  return n;
}

export async function stopSequencesForLead(leadId: number) {
  await db.update(sequenceEnrollments).set({ status: "stopped" }).where(and(eq(sequenceEnrollments.leadId, leadId), eq(sequenceEnrollments.status, "active")));
}

export function renderTemplate(tpl: string, lead: typeof leads.$inferSelect, extra: Record<string, string> = {}) {
  const vars: Record<string, string> = { name: lead.name, first_name: lead.name.split(" ")[0], email: lead.email || "", phone: lead.phone || "", booking_link: `${env.baseUrl}/contact?from=${lead.sourcePage}`, review_link: `${env.baseUrl}/reviews`, consult_type: "15-minute discovery call", ...extra };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/** Cron: send due drip steps. */
export async function runDueSequenceSteps() {
  const due = await db.select().from(sequenceEnrollments).where(and(eq(sequenceEnrollments.status, "active"), or(isNull(sequenceEnrollments.nextSendAt), lte(sequenceEnrollments.nextSendAt, new Date())))).limit(100);
  let sent = 0;
  for (const e of due) {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, e.leadId) });
    const steps = await db.select().from(emailSequenceSteps).where(eq(emailSequenceSteps.sequenceId, e.sequenceId)).orderBy(emailSequenceSteps.sort);
    const step = steps[e.currentStep];
    if (!lead || !step || ["won", "lost"].includes(lead.stage)) { await db.update(sequenceEnrollments).set({ status: lead && step ? "stopped" : "completed" }).where(eq(sequenceEnrollments.id, e.id)); continue; }
    if (step.channel === "sms" && lead.phone) await sendSms({ to: lead.phone, body: renderTemplate(step.body, lead), relatedType: "lead", relatedId: lead.id });
    else if (lead.email) await sendEmail({ to: lead.email, subject: renderTemplate(step.subject || "A note from Grace In Design", lead), text: renderTemplate(step.body, lead), relatedType: "lead", relatedId: lead.id });
    await db.insert(leadActivity).values({ leadId: lead.id, type: step.channel === "sms" ? "sms" : "email", body: `Sequence step sent: ${step.subject || step.body.slice(0, 60)}` });
    sent++;
    const next = steps[e.currentStep + 1];
    await db.update(sequenceEnrollments).set(next ? { currentStep: e.currentStep + 1, nextSendAt: new Date(Date.now() + next.delayHours * 3600000) } : { status: "completed", nextSendAt: null }).where(eq(sequenceEnrollments.id, e.id));
  }
  return sent;
}
