import "server-only";
/** Lead → project conversion and stage automation. */
import { and, asc, eq } from "drizzle-orm";
import { db, leads, leadActivity, projects, projectActivity, projectPhases, projectStages, invoices, milestones, documents, approvals, portalAccess, users } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import { sendEmail } from "@/lib/server/outbox";
import { emitEvent } from "@/lib/server/webhooks";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/server/crypto";
import { stopSequencesForLead } from "@/lib/server/sequences";

export async function nextProjectCode() {
  const year = new Date().getFullYear();
  const rows = await db.select({ code: projects.code }).from(projects);
  const max = rows.map((r) => Number((r.code.match(/-(\d+)$/) || [])[1] || 0)).reduce((a, b) => Math.max(a, b), 0);
  return `GID-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function firstStage() {
  const phase = await db.query.projectPhases.findFirst({ orderBy: asc(projectPhases.sort) });
  if (!phase) return null;
  return db.query.projectStages.findFirst({ where: eq(projectStages.phaseId, phase.id), orderBy: asc(projectStages.sort) });
}

/** "Mark signed → create project" (rules from site_settings.conversion_rules). */
export async function convertLeadToProject(leadId: number, userId: number | null, opts: { contractValue?: number | null; targetDate?: string | null; address?: string | null; serviceId?: number | null; name?: string | null } = {}) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!lead) throw new Error("Lead not found");
  if (lead.convertedProjectId) return db.query.projects.findFirst({ where: eq(projects.id, lead.convertedProjectId) });
  const rules = await getSetting("conversion_rules");
  const stage = await firstStage();
  const code = await nextProjectCode();
  const [project] = await db.insert(projects).values({
    code, leadId: lead.id, leadName: lead.name, serviceId: opts.serviceId ?? null, serviceName: lead.sourceLabel, name: opts.name || `${lead.name} — ${lead.pathId ? lead.pathId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Project"}`,
    stageId: stage?.id ?? null, ownerId: lead.ownerId ?? userId, contractValue: opts.contractValue != null ? String(opts.contractValue) : null, signedAt: new Date().toISOString().slice(0, 10), targetDate: opts.targetDate || null, address: opts.address || lead.address || null,
    answers: rules.copyAnswers ? lead.answers : {}, notes: rules.copyAnswers ? lead.notes : null, nextMilestone: rules.requestDepositInvoice ? "Request deposit" : "Kickoff",
  }).returning();
  await db.update(leads).set({ convertedProjectId: project.id, stage: rules.moveLeadToWon ? "won" : lead.stage, updatedAt: new Date() }).where(eq(leads.id, lead.id));
  await db.insert(leadActivity).values({ leadId: lead.id, userId, type: "stage", body: `Signed — project ${code} created` });
  await db.insert(projectActivity).values({ projectId: project.id, userId, type: "system", body: `Project created from lead “${lead.name}”` });
  await db.insert(milestones).values({ projectId: project.id, title: "Agreement signed", dueAt: project.signedAt, doneAt: new Date(), sort: 0 });
  if (rules.copyAnswers) {
    await db.insert(documents).values({ projectId: project.id, leadId: lead.id, name: "Lead form answers", url: `/admin/leads?open=${lead.id}`, type: "answers", visibleToClient: false, uploadedBy: userId });
    const leadDocs = await db.select().from(documents).where(and(eq(documents.leadId, lead.id), eq(documents.type, "proposal")));
    for (const d of leadDocs) await db.insert(documents).values({ projectId: project.id, leadId: lead.id, name: d.name, url: d.url, storageKey: d.storageKey, type: d.type, uploadedBy: userId });
  }
  if (rules.requestDepositInvoice && opts.contractValue) {
    const dep = Math.round(opts.contractValue * (project.depositPct / 100) * 100) / 100;
    await db.insert(invoices).values({ projectId: project.id, label: `Deposit (${project.depositPct}%)`, amount: String(dep), status: "pending", sort: 0, dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) });
  }
  if (rules.sendWelcomeEmail && lead.email) {
    const token = randomToken(18);
    await db.insert(portalAccess).values({ projectId: project.id, email: lead.email, token });
    await sendEmail({ to: lead.email, subject: `Welcome aboard — ${project.name}`, relatedType: "project", relatedId: project.id, text: `Hi ${lead.name.split(" ")[0]},\n\nWe're delighted to be working with you. Your project (${code}) is set up and here's what happens next: we'll confirm scope and schedule, then keep you posted at each milestone.\n\nYour client portal (documents, schedule, approvals): ${env.baseUrl}/portal/${token}\n\nGrace A. Williams\nGrace In Design` });
  }
  await stopSequencesForLead(lead.id).catch(() => {});
  await emitEvent("project.created", { projectId: project.id, code, leadId: lead.id, name: project.name, contractValue: project.contractValue });
  return project;
}

/** Per-stage automation hooks (configure in Project Pipeline → Configure stages). */
export async function runStageAutomation(projectId: number, stageId: number, userId: number | null) {
  const stage = await db.query.projectStages.findFirst({ where: eq(projectStages.id, stageId) }); if (!stage || stage.automation === "none") return null;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) }); if (!project) return null;
  const lead = project.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, project.leadId) }) : null;
  const value = Number(project.contractValue || 0);
  const log = (body: string) => db.insert(projectActivity).values({ projectId, userId, type: "automation", body });
  switch (stage.automation) {
    case "request_deposit": {
      const existing = await db.query.invoices.findFirst({ where: and(eq(invoices.projectId, projectId), eq(invoices.label, `Deposit (${project.depositPct}%)`)) });
      if (!existing && value > 0) { const [inv] = await db.insert(invoices).values({ projectId, label: `Deposit (${project.depositPct}%)`, amount: String(Math.round(value * project.depositPct) / 100), status: "pending", sort: 0, dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }).returning(); const { sendInvoice } = await import("@/lib/server/stripe"); if (lead?.email) await sendInvoice(inv.id, userId).catch(() => {}); await log(`Automation: deposit invoice created${lead?.email ? " and sent" : ""}`); }
      return "request_deposit";
    }
    case "send_invoice": {
      const pending = await db.query.invoices.findFirst({ where: and(eq(invoices.projectId, projectId), eq(invoices.status, "pending")), orderBy: asc(invoices.sort) });
      if (pending && lead?.email) { const { sendInvoice } = await import("@/lib/server/stripe"); await sendInvoice(pending.id, userId).catch(() => {}); await log(`Automation: invoice sent — ${pending.label}`); }
      return "send_invoice";
    }
    case "client_approval": {
      const [a] = await db.insert(approvals).values({ projectId, title: `Approve: ${stage.name}`, description: "Please review the concept and let us know if we can proceed." }).returning();
      if (lead?.email) { const pa = await db.query.portalAccess.findFirst({ where: eq(portalAccess.projectId, projectId) }); const link = pa ? `${env.baseUrl}/portal/${pa.token}` : `${env.baseUrl}/contact`; await sendEmail({ to: lead.email, subject: `Your approval is needed — ${project.name}`, relatedType: "project", relatedId: projectId, text: `Hi ${lead.name.split(" ")[0]},\n\nWe've reached “${stage.name}” on ${project.name} and need your approval to continue.\n\nReview and respond here: ${link}\n\nGrace In Design` }); }
      await log(`Automation: client approval requested (#${a.id})`);
      return "client_approval";
    }
    case "schedule_install": {
      await db.insert(milestones).values({ projectId, title: "Installation scheduled", dueAt: project.targetDate, sort: 99 });
      const owner = project.ownerId ? await db.query.users.findFirst({ where: eq(users.id, project.ownerId) }) : null;
      if (owner?.email) await sendEmail({ to: owner.email, subject: `Schedule install — ${project.name}`, text: `${project.name} moved to “${stage.name}”. Please schedule the installation and confirm the date with the client.\n\n${env.baseUrl}/admin/projects?open=${projectId}` });
      await log("Automation: install milestone added and owner notified");
      return "schedule_install";
    }
    case "request_review": {
      if (lead?.email) await sendEmail({ to: lead.email, subject: "Thank you from Grace In Design", relatedType: "project", relatedId: projectId, text: `Hi ${lead.name.split(" ")[0]},\n\nThank you for trusting us with ${project.name}. If you have a minute, a short review helps other families and businesses find us:\n\nGoogle: https://g.page/r/graceindesign/review\n\nWith gratitude,\nGrace` });
      await log("Automation: review request sent");
      return "request_review";
    }
  }
  return null;
}
