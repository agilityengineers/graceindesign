// server-only (also used by scripts/cron.ts)
/** Lead board columns (lead_stages) and the auto-delete sweep for columns such as "Trash". */
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, leads, leadStages, DEFAULT_LEAD_STAGES, type LeadStageDef } from "@/lib/db";
import { audit } from "@/lib/server/audit";

/** Board columns in order. Seeds the defaults the first time (fresh database before the seed script has run). */
export async function getLeadStages(): Promise<LeadStageDef[]> {
  let rows = await db.select().from(leadStages).orderBy(asc(leadStages.sort), asc(leadStages.createdAt));
  if (!rows.length) {
    await db.insert(leadStages).values(DEFAULT_LEAD_STAGES.map((s, i) => ({ ...s, sort: i }))).onConflictDoNothing();
    rows = await db.select().from(leadStages).orderBy(asc(leadStages.sort), asc(leadStages.createdAt));
  }
  return rows.map((r) => ({ key: r.key, label: r.label, bg: r.bg, fg: r.fg, autoDeleteDays: r.autoDeleteDays }));
}

export async function isLeadStage(key: string) {
  if (!key) return false;
  const [row] = await db.select({ key: leadStages.key }).from(leadStages).where(eq(leadStages.key, key)).limit(1);
  return !!row;
}

export async function stageLabel(key: string) {
  const [row] = await db.select({ label: leadStages.label }).from(leadStages).where(eq(leadStages.key, key)).limit(1);
  return row?.label || DEFAULT_LEAD_STAGES.find((s) => s.key === key)?.label || key;
}

/** "Trash bin" → "trash_bin", made unique against the existing keys. */
export function stageKeyFor(label: string, taken: string[]) {
  const base = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "column";
  let key = base; let i = 2;
  while (taken.includes(key)) key = `${base}_${i++}`;
  return key;
}

/**
 * Deletes leads that have sat in an auto-delete column (e.g. Trash, 14 days) longer than its limit.
 * The clock is `leads.stage_changed_at`, so dragging a lead out of the column stops it. Leads that became a project are kept.
 */
export async function purgeExpiredLeads() {
  const cols = (await db.select().from(leadStages)).filter((c) => c.autoDeleteDays != null && c.autoDeleteDays > 0);
  const out: Record<string, number> = {};
  for (const c of cols) {
    const cutoff = new Date(Date.now() - c.autoDeleteDays! * 864e5);
    const due = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.stage, c.key), lt(leads.stageChangedAt, cutoff), isNull(leads.convertedProjectId))).limit(500);
    if (!due.length) { out[c.key] = 0; continue; }
    const ids = due.map((d) => d.id);
    await db.delete(leads).where(inArray(leads.id, ids));
    await audit(null, "auto_delete", "lead", null, { column: c.key, days: c.autoDeleteDays, ids });
    out[c.key] = ids.length;
  }
  return out;
}

/** How many leads sit in each column (archived or not), for the column editor. */
export async function leadCountsByStage() {
  const rows = await db.select({ stage: leads.stage, n: sql<number>`count(*)` }).from(leads).groupBy(leads.stage);
  return new Map(rows.map((r) => [r.stage, Number(r.n)]));
}
