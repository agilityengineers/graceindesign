import { desc, eq, asc } from "drizzle-orm";
import { db, leads, users, ccSubscribers, newsletterSubscribers } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { LEAD_STAGE_LABELS } from "@/lib/db";
export const dynamic = "force-dynamic";
const csv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map((v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
export async function GET(req: Request) {
  const u = await getCurrentUser(); if (!u) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url); const kind = url.searchParams.get("kind") || "leads";
  if (kind === "leads") {
    if (!can(u, "leads")) return new Response("Forbidden", { status: 403 });
    const rows = await db.select({ l: leads, owner: users.name }).from(leads).leftJoin(users, eq(users.id, leads.ownerId)).orderBy(desc(leads.createdAt));
    const src = url.searchParams.get("source");
    const out = rows.filter((r) => !src || (r.l.sourceLabel || r.l.sourcePage) === src).map((r) => [r.l.id, r.l.name, r.l.email, r.l.phone, r.l.company, r.l.sourceLabel || r.l.sourcePage, r.l.pathId, LEAD_STAGE_LABELS[r.l.stage], r.owner || "Unassigned", r.l.budget, r.l.timeline, r.l.tags.join("; "), r.l.followUpAt, r.l.createdAt.toISOString(), JSON.stringify(r.l.answers)]);
    return new Response(csv([["id", "name", "email", "phone", "company", "source", "path", "stage", "owner", "budget", "timeline", "tags", "follow_up", "created_at", "answers"], ...out]), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  if (kind === "cc-subscribers") {
    if (!can(u, "caribbean")) return new Response("Forbidden", { status: 403 });
    const rows = await db.select().from(ccSubscribers).orderBy(asc(ccSubscribers.createdAt));
    return new Response(csv([["email", "segment", "location", "country", "consented_at", "unsubscribed_at"], ...rows.map((r) => [r.email, r.segment, r.location, r.country, r.consentedAt.toISOString(), r.unsubscribedAt?.toISOString()])]), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="caribbean-subscribers.csv"` } });
  }
  if (kind === "newsletter") {
    if (!can(u, "pages")) return new Response("Forbidden", { status: 403 });
    const rows = await db.select().from(newsletterSubscribers);
    return new Response(csv([["email", "source", "consented_at"], ...rows.map((r) => [r.email, r.source, r.consentedAt.toISOString()])]), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="newsletter.csv"` } });
  }
  return new Response("Unknown export", { status: 400 });
}
