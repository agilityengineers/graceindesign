import "server-only";
/** Phase 4 — Proposals + e-signature. Built-in click-to-sign (typed name + IP + timestamp) with an optional Dropbox Sign adapter. */
import { eq } from "drizzle-orm";
import { db, proposals, leads, leadActivity, projects, projectActivity } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/server/outbox";
import { randomToken } from "@/lib/server/crypto";
import { emitEvent } from "@/lib/server/webhooks";

export async function sendProposal(id: number, userId?: number | null) {
  const p = await db.query.proposals.findFirst({ where: eq(proposals.id, id) }); if (!p) throw new Error("Proposal not found");
  const lead = p.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, p.leadId) }) : null;
  const to = p.recipientEmail || lead?.email; if (!to) throw new Error("No recipient email");
  const token = p.token || randomToken(24);
  const link = `${env.baseUrl}/proposal/${token}`;
  let provider = "builtin", requestId: string | null = null;
  if (env.dropboxSignKey) {
    try {
      const r = await fetch("https://api.hellosign.com/v3/signature_request/send", { method: "POST", headers: { authorization: `Basic ${Buffer.from(env.dropboxSignKey + ":").toString("base64")}`, "content-type": "application/json" }, body: JSON.stringify({ title: p.title, subject: `Proposal: ${p.title}`, message: "Please review and sign.", signers: [{ email_address: to, name: p.recipientName || lead?.name || to }], file_urls: [`${env.baseUrl}/api/proposal/${token}/pdf`], test_mode: env.isProd ? 0 : 1 }) });
      const j: any = await r.json(); if (r.ok && j.signature_request?.signature_request_id) { provider = "dropbox_sign"; requestId = j.signature_request.signature_request_id; }
    } catch { /* fall back to built-in */ }
  }
  await db.update(proposals).set({ status: "sent", sentAt: new Date(), token, recipientEmail: to, recipientName: p.recipientName || lead?.name || null, esignProvider: provider, esignRequestId: requestId, updatedAt: new Date() }).where(eq(proposals.id, id));
  if (provider === "builtin") await sendEmail({ to, subject: `Your proposal from Grace In Design: ${p.title}`, relatedType: "proposal", relatedId: p.id, text: `Hi ${(p.recipientName || lead?.name || "there").split(" ")[0]},\n\nYour proposal is ready to review and sign online:\n${link}\n\nQuestions? Reply to this email or call (770) 691-1600.\n\nGrace A. Williams\nGrace In Design` });
  if (lead) await db.insert(leadActivity).values({ leadId: lead.id, userId: userId ?? null, type: "proposal", body: `Proposal sent: ${p.title}${p.amount ? ` — $${Number(p.amount).toLocaleString()}` : ""}`, attachmentUrl: link });
  if (lead && lead.stage !== "won") await db.update(leads).set({ stage: "proposal_sent", updatedAt: new Date() }).where(eq(leads.id, lead.id));
  return link;
}

export async function signProposal(token: string, signerName: string, ip: string | null, signatureData?: string) {
  const p = await db.query.proposals.findFirst({ where: eq(proposals.token, token) }); if (!p || p.status === "signed" || p.status === "declined") return null;
  await db.update(proposals).set({ status: "signed", signedAt: new Date(), signerName, signerIp: ip, signatureData: signatureData || null, esignProvider: p.esignProvider || "builtin", updatedAt: new Date() }).where(eq(proposals.id, p.id));
  if (p.leadId) await db.insert(leadActivity).values({ leadId: p.leadId, type: "proposal", body: `Proposal signed by ${signerName}: ${p.title}` });
  if (p.projectId) await db.insert(projectActivity).values({ projectId: p.projectId, type: "proposal", body: `Proposal signed by ${signerName}: ${p.title}` });
  await emitEvent("proposal.signed", { proposalId: p.id, leadId: p.leadId, projectId: p.projectId, amount: p.amount, signerName });
  if (p.recipientEmail) await sendEmail({ to: p.recipientEmail, subject: `Signed: ${p.title}`, text: `Thank you, ${signerName}. Your signed proposal is on file. A copy is always available at ${env.baseUrl}/proposal/${token}.\n\nGrace In Design` });
  return p;
}
export { projects };
