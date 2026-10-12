/**
 * Outbound webhooks (HMAC-signed) so Call Flow Tracker, Zapier or any CRM can subscribe to
 * Grace In Design events. Mirrors CFT's own dispatcher: envelope { event, sentAt, data },
 * header X-GID-Event and X-GID-Signature: sha256=<hex hmac of body>.
 */
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { db, webhookSubscriptions, webhookDeliveries } from "@/lib/db";
import { decrypt, hmacHex } from "@/lib/server/crypto";

export type GidEvent = "lead.created" | "lead.updated" | "lead.stage_changed" | "booking.created" | "booking.cancelled" | "project.created" | "project.stage_changed" | "invoice.paid" | "proposal.signed" | "cc.submission.created" | "cc.submission.published";
export const GID_EVENTS: GidEvent[] = ["lead.created", "lead.updated", "lead.stage_changed", "booking.created", "booking.cancelled", "project.created", "project.stage_changed", "invoice.paid", "proposal.signed", "cc.submission.created", "cc.submission.published"];

const MAX_ATTEMPTS = 5;
const TIMEOUT_MS = 10000;

export async function emitEvent(event: GidEvent, data: Record<string, unknown>) {
  const subs = await db.query.webhookSubscriptions.findMany({ where: eq(webhookSubscriptions.isActive, true) });
  const matching = subs.filter((s) => s.events.includes(event) || s.events.includes("*"));
  if (!matching.length) return;
  const envelope = { event, sentAt: new Date().toISOString(), data };
  const rows = await db.insert(webhookDeliveries).values(matching.map((s) => ({ subscriptionId: s.id, event, payload: envelope, status: "pending", nextRetryAt: new Date() }))).returning();
  // Fire-and-forget; retries handled by cron "webhooks".
  void Promise.allSettled(rows.map((r) => deliver(r.id)));
}

export async function deliver(deliveryId: number) {
  const d = await db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, deliveryId) });
  if (!d || d.status === "delivered") return;
  const sub = await db.query.webhookSubscriptions.findFirst({ where: eq(webhookSubscriptions.id, d.subscriptionId) });
  if (!sub || !sub.isActive) { await db.update(webhookDeliveries).set({ status: "failed", lastError: "subscription inactive" }).where(eq(webhookDeliveries.id, d.id)); return; }
  if (!isSafeUrl(sub.url)) { await db.update(webhookDeliveries).set({ status: "failed", lastError: "unsafe url" }).where(eq(webhookDeliveries.id, d.id)); return; }
  const body = JSON.stringify(d.payload);
  const secret = decrypt(sub.secretEnc);
  const headers: Record<string, string> = { "content-type": "application/json", "x-gid-event": d.event, "user-agent": "GraceInDesign-Webhooks/1.0" };
  if (secret) headers["x-gid-signature"] = `sha256=${hmacHex(secret, body)}`;
  const attempt = d.attempts + 1;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(sub.url, { method: "POST", headers, body, signal: ctrl.signal, redirect: "manual" });
    clearTimeout(t);
    if (res.status >= 200 && res.status < 300) {
      await db.update(webhookDeliveries).set({ status: "delivered", attempts: attempt, responseStatus: res.status, updatedAt: new Date() }).where(eq(webhookDeliveries.id, d.id));
      return;
    }
    await scheduleRetry(d.id, attempt, `HTTP ${res.status}`, res.status);
  } catch (e: any) {
    await scheduleRetry(d.id, attempt, String(e?.message || e));
  }
}

async function scheduleRetry(id: number, attempt: number, error: string, status?: number) {
  if (attempt >= MAX_ATTEMPTS) {
    await db.update(webhookDeliveries).set({ status: "failed", attempts: attempt, lastError: error, responseStatus: status, updatedAt: new Date() }).where(eq(webhookDeliveries.id, id));
    return;
  }
  const backoffMs = 2000 * Math.pow(3, attempt - 1);
  await db.update(webhookDeliveries).set({ status: "pending", attempts: attempt, lastError: error, responseStatus: status, nextRetryAt: new Date(Date.now() + backoffMs), updatedAt: new Date() }).where(eq(webhookDeliveries.id, id));
}

export async function retryDueDeliveries(limit = 50) {
  const due = await db.query.webhookDeliveries.findMany({ where: and(eq(webhookDeliveries.status, "pending"), or(isNull(webhookDeliveries.nextRetryAt), lte(webhookDeliveries.nextRetryAt, new Date()))), limit, orderBy: sql`${webhookDeliveries.nextRetryAt} asc nulls first` });
  for (const d of due) await deliver(d.id);
  return due.length;
}

export function isSafeUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && process.env.NODE_ENV !== "production")) return false;
    const h = u.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\])/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return process.env.NODE_ENV !== "production";
    return true;
  } catch { return false; }
}
