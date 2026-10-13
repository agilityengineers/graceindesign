import "server-only";
/**
 * Inbound events from Call Flow Tracker's outbound webhooks (server/outboundWebhookService.ts):
 *   lead.created | call.completed | disposition.changed | appointment.booked
 * Envelope: { event, sentAt, data }, header X-CallFlow-Signature: sha256=<hmac hex of body>.
 */
import { and, eq, or, desc } from "drizzle-orm";
import { db, leads, leadActivity, bookings, webhookEvents } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacHex, timingSafeEqual, sha256Hex } from "@/lib/server/crypto";
import { normalizePhone } from "@/lib/server/outbox-phone";
import { notifyTeam } from "@/lib/server/notify";

export function verifyCftSignature(headers: Headers, raw: string) {
  if (!env.cft.webhookSecret) return false;
  const sig = headers.get("x-callflow-signature") || "";
  const expected = `sha256=${hmacHex(env.cft.webhookSecret, raw)}`;
  return timingSafeEqual(sig, expected);
}

type Envelope = { event: string; sentAt?: string; data: Record<string, any> };

export async function processCftEvent(raw: string): Promise<{ status: string; leadId?: number }> {
  const env_: Envelope = JSON.parse(raw);
  const dedupeKey = `cft:${sha256Hex(raw)}`;
  const [evt] = await db.insert(webhookEvents).values({ source: "cft", dedupeKey, eventType: env_.event, payload: env_, status: "received" }).onConflictDoNothing().returning();
  if (!evt) return { status: "duplicate" };
  try {
    const d = env_.data || {};
    const phone = normalizePhone(d.phoneNumber || d.phone || d.from || d.callerNumber || null);
    const email = (d.email || "").toLowerCase() || null;
    const name = d.name || [d.firstName, d.lastName].filter(Boolean).join(" ") || d.callerName || phone || "Unknown caller";
    const externalId = d.contactId ?? d.id ?? d.leadId ?? d.callId ?? null;
    const findLead = async () => db.query.leads.findFirst({ where: or(externalId ? and(eq(leads.externalSource, "cft"), eq(leads.externalId, String(externalId))) : undefined, email ? eq(leads.email, email) : undefined, phone ? eq(leads.phone, phone) : undefined), orderBy: desc(leads.createdAt) });
    let lead = await findLead();
    let result = "processed";
    switch (env_.event) {
      case "lead.created": {
        if (!lead) {
          [lead] = await db.insert(leads).values({ name, email, phone, sourcePage: "cft", sourceLabel: `Call Flow Tracker${d.campaignName ? ` · ${d.campaignName}` : ""}`, stage: "new", externalSource: "cft", externalId: externalId ? String(externalId) : null, answers: { cft: d }, tags: ["CFT"], consentAt: null, followUpAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }).returning();
          await db.insert(leadActivity).values({ leadId: lead.id, type: "webhook", body: "Lead created from Call Flow Tracker", meta: d });
        } else {
          await db.update(leads).set({ externalSource: "cft", externalId: externalId ? String(externalId) : lead.externalId, updatedAt: new Date() }).where(eq(leads.id, lead.id));
          await db.insert(leadActivity).values({ leadId: lead.id, type: "webhook", body: "Matched to Call Flow Tracker lead", meta: d });
        }
        break;
      }
      case "call.completed": {
        if (!lead) [lead] = await db.insert(leads).values({ name, email, phone, sourcePage: "cft", sourceLabel: "Call Flow Tracker · inbound call", stage: "contacted", externalSource: "cft", externalId: externalId ? String(externalId) : null, answers: { cft: d }, tags: ["CFT", "Phone"] }).returning();
        const dur = d.duration ?? d.durationSeconds; const outcome = d.status || d.disposition || "completed";
        await db.insert(leadActivity).values({ leadId: lead.id, type: "call", body: `Call ${outcome}${dur ? ` · ${Math.round(Number(dur) / 60)} min` : ""}${d.campaignName ? ` · ${d.campaignName}` : ""}${d.recordingUrl ? " · recording available" : ""}`, attachmentUrl: d.recordingUrl || null, meta: d });
        if (lead.stage === "new") await db.update(leads).set({ stage: "contacted", updatedAt: new Date() }).where(eq(leads.id, lead.id));
        break;
      }
      case "disposition.changed": {
        if (!lead) { result = "ignored"; break; }
        const disp = String(d.disposition || d.leadStatus || "").toLowerCase();
        const map: Record<string, typeof lead.stage> = { won: "won", qualified: "proposal_sent", contacted: "contacted", lost: "lost", dnc: "lost", nurture: "nurture" };
        const stage = map[disp];
        await db.insert(leadActivity).values({ leadId: lead.id, type: "stage", body: `CFT disposition: ${d.disposition || d.leadStatus}${stage ? ` → ${stage}` : ""}`, meta: d });
        if (stage && !["won"].includes(lead.stage)) await db.update(leads).set({ stage, updatedAt: new Date() }).where(eq(leads.id, lead.id));
        break;
      }
      case "appointment.booked": {
        if (!lead) [lead] = await db.insert(leads).values({ name, email, phone, sourcePage: "cft", sourceLabel: "Call Flow Tracker · appointment", stage: "consultation_booked", externalSource: "cft", externalId: externalId ? String(externalId) : null, answers: { cft: d }, tags: ["CFT"] }).returning();
        const start = new Date(d.startsAt || d.scheduledAt || d.startTime || Date.now() + 86400000);
        const end = new Date(d.endsAt || start.getTime() + 15 * 60000);
        const [bk] = await db.insert(bookings).values({ leadId: lead.id, type: d.type || "discovery_15", startsAt: start, endsAt: end, status: "booked", externalId: d.appointmentId ? String(d.appointmentId) : null, notes: d.notes || null }).returning();
        await db.update(leads).set({ stage: "consultation_booked", updatedAt: new Date() }).where(eq(leads.id, lead.id));
        await db.insert(leadActivity).values({ leadId: lead.id, type: "booking", body: "Appointment booked via Call Flow Tracker", meta: { bookingId: bk.id, ...d } });
        break;
      }
      default: result = "ignored";
    }
    await db.update(webhookEvents).set({ status: result, processedAt: new Date() }).where(eq(webhookEvents.id, evt.id));
    if (result === "processed" && lead) await announceCftEvent(env_.event, d, lead).catch((e) => console.error("cft slack notice failed", String(e?.message || e)));
    return { status: result, leadId: lead?.id };
  } catch (e: any) {
    await db.update(webhookEvents).set({ status: "failed", error: String(e?.message || e).slice(0, 1000), processedAt: new Date() }).where(eq(webhookEvents.id, evt.id));
    throw e;
  }
}

/** Tell the team (Slack) what Call Flow Tracker just reported, with a button that signs Grace in to act on it. */
async function announceCftEvent(event: string, d: Record<string, any>, lead: typeof leads.$inferSelect) {
  const who = `${lead.name}${lead.phone ? ` · ${lead.phone}` : ""}`;
  const dur = d.duration ?? d.durationSeconds;
  const titles: Record<string, string> = {
    "lead.created": `Call Flow Tracker: new lead — ${lead.name}`,
    "call.completed": `Call Flow Tracker: call ${d.status || d.disposition || "completed"} — ${lead.name}`,
    "disposition.changed": `Call Flow Tracker: ${d.disposition || d.leadStatus || "status changed"} — ${lead.name}`,
    "appointment.booked": `Call Flow Tracker: appointment booked — ${lead.name}`,
  };
  const body = event === "call.completed"
    ? `${who}${dur ? ` · ${Math.round(Number(dur) / 60)} min` : ""}${d.campaignName ? ` · ${d.campaignName}` : ""}${d.summary ? `\n${String(d.summary).slice(0, 600)}` : ""}${d.recordingUrl ? "\nA recording is available in Call Flow Tracker." : ""}`
    : `${who}${d.campaignName ? ` · ${d.campaignName}` : ""}${d.notes ? `\n${String(d.notes).slice(0, 400)}` : ""}`;
  await notifyTeam({ kind: "cft_event", title: titles[event] || `Call Flow Tracker: ${event} — ${lead.name}`, body, fields: [["Caller", lead.name], ["Phone", lead.phone || "—"], ["Email", lead.email || "—"], ...(d.campaignName ? [["Campaign", String(d.campaignName)] as [string, string]] : []), ...(dur ? [["Duration", `${Math.round(Number(dur) / 60)} min`] as [string, string]] : []), ...(d.recordingUrl ? [["Recording", "Listen in Call Flow Tracker"] as [string, string]] : [])], adminPath: `/admin/leads?open=${lead.id}`, cftTarget: event === "call.completed" ? "/calls" : "/crm", relatedType: "lead", relatedId: lead.id });
}
