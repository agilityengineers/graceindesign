// server-only (also used by scripts/cron.ts)
/** Scheduled jobs. Run via /api/cron/<job> (bearer CRON_SECRET) or `npm run cron -- <job>`. */
import { and, eq, gte, lte, isNull, lt, sql } from "drizzle-orm";
import { db, bookings, leads, cronRuns, outbox, socialPosts } from "@/lib/db";
import { getSetting } from "@/lib/server/settings";
import { sendEmail, sendSms, deliverOutbox } from "@/lib/server/outbox";
import { purgeAuthOutboxBodies } from "@/lib/server/outbox-privacy";
import { fmtWhen } from "@/lib/server/consult";
import { syncAllRss } from "@/lib/server/rss";
import { syncEtsyProducts } from "@/lib/server/etsy";
import { retryDueDeliveries } from "@/lib/server/webhooks";
import { runDueSequenceSteps } from "@/lib/server/sequences";
import { dispatchDueSocialPosts, syncSocialFeeds } from "@/lib/server/social";
import { runHubspotSync } from "@/lib/server/hubspot";

export const JOBS = ["reminders", "rss", "etsy", "social", "drips", "webhooks", "outbox", "hubspot", "all"] as const;
export type Job = (typeof JOBS)[number];

export async function runJob(job: Job): Promise<Record<string, unknown>> {
  const [run] = await db.insert(cronRuns).values({ job }).returning();
  try {
    const summary = job === "all" ? await runAll() : await (JOB_FNS[job] as () => Promise<Record<string, unknown>>)();
    await db.update(cronRuns).set({ status: "ok", summary, finishedAt: new Date() }).where(eq(cronRuns.id, run.id));
    return summary;
  } catch (e: any) {
    await db.update(cronRuns).set({ status: "failed", summary: { error: String(e?.message || e) }, finishedAt: new Date() }).where(eq(cronRuns.id, run.id));
    throw e;
  }
}
async function runAll() { const out: Record<string, unknown> = {}; for (const j of JOBS.filter((x) => x !== "all")) { try { out[j] = await JOB_FNS[j](); } catch (e: any) { out[j] = { error: String(e?.message || e) }; } } return out; }

const JOB_FNS: Record<Exclude<Job, "all">, () => Promise<Record<string, unknown>>> = {
  async reminders() {
    const booking = await getSetting("booking");
    if (!booking.reminder24h) return { skipped: "disabled" };
    const from = new Date(Date.now() + 23 * 3600000), to = new Date(Date.now() + 25 * 3600000);
    const due = await db.select().from(bookings).where(and(eq(bookings.status, "booked"), isNull(bookings.reminderSentAt), gte(bookings.startsAt, from), lte(bookings.startsAt, to)));
    let sent = 0;
    for (const b of due) {
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, b.leadId) }); if (!lead) continue;
      const when = fmtWhen(b.startsAt); const first = lead.name.split(" ")[0];
      if (lead.email) await sendEmail({ to: lead.email, subject: `Reminder: your consultation is tomorrow (${when})`, text: `Hi ${first},\n\nA quick reminder that your consultation with Grace In Design is tomorrow, ${when}. We'll call ${lead.phone || "you"}.\n\nNeed to reschedule? Reply to this email or call (770) 691-1600.\n\nGrace`, relatedType: "booking", relatedId: b.id });
      if (lead.phone && booking.smsConfirm) await sendSms({ to: lead.phone, body: `Reminder: your consultation with Grace In Design is tomorrow at ${when}. Need to reschedule? Call (770) 691-1600.`, relatedType: "booking", relatedId: b.id });
      await db.update(bookings).set({ reminderSentAt: new Date() }).where(eq(bookings.id, b.id));
      sent++;
    }
    return { sent };
  },
  async rss() { return { sources: await syncAllRss() }; },
  async etsy() { return { updated: await syncEtsyProducts() }; },
  async social() { const dispatched = await dispatchDueSocialPosts(); const feeds = await syncSocialFeeds(); return { dispatched, feeds }; },
  async drips() { return { sent: await runDueSequenceSteps() }; },
  async webhooks() { return { retried: await retryDueDeliveries() }; },
  async outbox() {
    await purgeAuthOutboxBodies();
    const retryable = sql`(${outbox.authExpiresAt} is null or (${outbox.authExpiresAt} > now() and ${outbox.bodyText} is not null))`;
    const queued = await db.select({ id: outbox.id }).from(outbox).where(and(retryable, eq(outbox.status, "queued"), lt(outbox.attempts, 3))).limit(50);
    for (const r of queued) await deliverOutbox(r.id);
    const failed = await db.select({ id: outbox.id }).from(outbox).where(and(retryable, eq(outbox.status, "failed"), lt(outbox.attempts, 3), sql`${outbox.createdAt} > now() - interval '2 days'`)).limit(20);
    for (const r of failed) await deliverOutbox(r.id);
    return { retried: queued.length + failed.length };
  },
  async hubspot() { return await runHubspotSync(); },
};
export { socialPosts };
