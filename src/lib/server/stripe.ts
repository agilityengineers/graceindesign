import "server-only";
/** Phase 4 — Stripe invoicing (deposit / progress / final). Falls back to manual status when no key. */
import { eq } from "drizzle-orm";
import { db, invoices, projects, leads, projectActivity } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/server/outbox";
import { emitEvent } from "@/lib/server/webhooks";

export function stripeConfigured() { return !!env.stripe.secret; }
async function stripe() { const Stripe = (await import("stripe")).default; return new Stripe(env.stripe.secret, { apiVersion: "2025-02-24.acacia" as any }); }

export async function sendInvoice(invoiceId: number, userId?: number | null) {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) }); if (!inv) throw new Error("Invoice not found");
  const project = await db.query.projects.findFirst({ where: eq(projects.id, inv.projectId) }); if (!project) throw new Error("Project not found");
  const lead = project.leadId ? await db.query.leads.findFirst({ where: eq(leads.id, project.leadId) }) : null;
  const email = lead?.email; if (!email) throw new Error("No client email on this project's lead");
  let hostedUrl = inv.stripeHostedUrl;
  if (stripeConfigured()) {
    const s = await stripe();
    const customers = await s.customers.list({ email, limit: 1 });
    const customer = customers.data[0] || (await s.customers.create({ email, name: lead?.name || project.leadName || undefined }));
    const si = await s.invoices.create({ customer: customer.id, collection_method: "send_invoice", days_until_due: 14, metadata: { gid_invoice_id: String(inv.id), gid_project: project.code } });
    await s.invoiceItems.create({ customer: customer.id, invoice: si.id, amount: Math.round(Number(inv.amount) * 100), currency: "usd", description: `${project.name} — ${inv.label}` });
    const finalized = await s.invoices.finalizeInvoice(si.id);
    await s.invoices.sendInvoice(finalized.id);
    hostedUrl = finalized.hosted_invoice_url || null;
    await db.update(invoices).set({ stripeInvoiceId: finalized.id, stripeHostedUrl: hostedUrl, status: "scheduled", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
  } else {
    await db.update(invoices).set({ status: "scheduled", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
    await sendEmail({ to: email, subject: `Invoice: ${project.name} — ${inv.label}`, relatedType: "invoice", relatedId: inv.id, text: `Hi ${(lead?.name || "there").split(" ")[0]},\n\nPlease find your invoice for ${project.name}:\n\n${inv.label}: $${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}${inv.dueAt ? `\nDue: ${inv.dueAt}` : ""}\n\nPayment instructions will follow (online payments arrive once Stripe is connected).\n\nThank you,\nGrace In Design` });
  }
  await db.insert(projectActivity).values({ projectId: project.id, userId: userId ?? null, type: "invoice", body: `Invoice sent: ${inv.label} ($${Number(inv.amount).toLocaleString()})${hostedUrl ? " via Stripe" : ""}` });
  return hostedUrl;
}

export async function markInvoicePaid(invoiceId: number, userId?: number | null, source = "manual") {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) }); if (!inv) return;
  await db.update(invoices).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(invoices.id, inv.id));
  await db.insert(projectActivity).values({ projectId: inv.projectId, userId: userId ?? null, type: "payment", body: `Payment received: ${inv.label} ($${Number(inv.amount).toLocaleString()}) · ${source}` });
  await emitEvent("invoice.paid", { invoiceId: inv.id, projectId: inv.projectId, amount: inv.amount, label: inv.label, source });
}

export async function handleStripeWebhook(raw: string, sig: string) {
  if (!stripeConfigured() || !env.stripe.webhookSecret) return { ignored: true };
  const s = await stripe();
  const event = s.webhooks.constructEvent(raw, sig, env.stripe.webhookSecret);
  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const si: any = event.data.object; const gid = Number(si.metadata?.gid_invoice_id);
    if (gid) await markInvoicePaid(gid, null, "stripe");
  }
  return { received: event.type };
}
