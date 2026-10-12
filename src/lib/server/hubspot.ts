// server-only (also used by scripts/cron.ts)
/** Phase 4 — HubSpot sync (contacts ⇐ leads, deals ⇐ projects). No-op until HUBSPOT_ACCESS_TOKEN is set. */
import { and, eq, isNull, or, gt, desc } from "drizzle-orm";
import { db, leads, projects, hubspotSync } from "@/lib/db";
import { env } from "@/lib/env";

const H = "https://api.hubapi.com";
async function hs(path: string, init: RequestInit = {}) {
  const r = await fetch(`${H}${path}`, { ...init, headers: { authorization: `Bearer ${env.hubspotToken}`, "content-type": "application/json", ...(init.headers || {}) } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `HubSpot HTTP ${r.status}`);
  return j;
}

export async function syncLeadToHubspot(leadId: number) {
  if (!env.hubspotToken) return { skipped: "not configured" };
  const l = await db.query.leads.findFirst({ where: eq(leads.id, leadId) }); if (!l || !l.email) return { skipped: "no email" };
  const [first, ...rest] = l.name.split(" ");
  const props = { email: l.email, firstname: first, lastname: rest.join(" "), phone: l.phone || "", lifecyclestage: l.stage === "won" ? "customer" : "lead", hs_lead_status: l.stage.toUpperCase(), gid_source_page: l.sourcePage, gid_path: l.pathId || "" };
  try {
    let id = l.hubspotId;
    if (id) await hs(`/crm/v3/objects/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
    else {
      const search = await hs("/crm/v3/objects/contacts/search", { method: "POST", body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: l.email }] }], limit: 1 }) });
      id = search.results?.[0]?.id;
      if (id) await hs(`/crm/v3/objects/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
      else id = (await hs("/crm/v3/objects/contacts", { method: "POST", body: JSON.stringify({ properties: props }) })).id;
      await db.update(leads).set({ hubspotId: id }).where(eq(leads.id, l.id));
    }
    await db.insert(hubspotSync).values({ objectType: "contact", objectId: l.id, hubspotId: id, status: "ok", lastSyncedAt: new Date() }).onConflictDoUpdate({ target: [hubspotSync.objectType, hubspotSync.objectId], set: { hubspotId: id, status: "ok", error: null, lastSyncedAt: new Date() } });
    return { ok: true, id };
  } catch (e: any) {
    await db.insert(hubspotSync).values({ objectType: "contact", objectId: l.id, status: "error", error: String(e.message) }).onConflictDoUpdate({ target: [hubspotSync.objectType, hubspotSync.objectId], set: { status: "error", error: String(e.message) } });
    return { error: String(e.message) };
  }
}

export async function syncProjectToHubspot(projectId: number) {
  if (!env.hubspotToken) return { skipped: "not configured" };
  const p = await db.query.projects.findFirst({ where: eq(projects.id, projectId) }); if (!p) return { skipped: "missing" };
  const props = { dealname: p.name, amount: p.contractValue || "0", dealstage: p.status === "active" ? "contractsent" : "closedwon", closedate: p.targetDate ? new Date(p.targetDate).toISOString() : undefined, gid_code: p.code };
  try {
    let id = p.hubspotDealId;
    if (id) await hs(`/crm/v3/objects/deals/${id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
    else { id = (await hs("/crm/v3/objects/deals", { method: "POST", body: JSON.stringify({ properties: props }) })).id; await db.update(projects).set({ hubspotDealId: id }).where(eq(projects.id, p.id)); }
    await db.insert(hubspotSync).values({ objectType: "deal", objectId: p.id, hubspotId: id, status: "ok", lastSyncedAt: new Date() }).onConflictDoUpdate({ target: [hubspotSync.objectType, hubspotSync.objectId], set: { hubspotId: id, status: "ok", error: null, lastSyncedAt: new Date() } });
    return { ok: true, id };
  } catch (e: any) { return { error: String(e.message) }; }
}

/** Cron: push recently changed leads/projects. */
export async function runHubspotSync() {
  if (!env.hubspotToken) return { skipped: "HUBSPOT_ACCESS_TOKEN not set" };
  const since = new Date(Date.now() - 2 * 3600000);
  const ls = await db.select({ id: leads.id }).from(leads).where(or(isNull(leads.hubspotId), gt(leads.updatedAt, since))).orderBy(desc(leads.updatedAt)).limit(50);
  const ps = await db.select({ id: projects.id }).from(projects).where(or(isNull(projects.hubspotDealId), gt(projects.updatedAt, since))).limit(50);
  let contacts = 0, deals = 0;
  for (const l of ls) { const r = await syncLeadToHubspot(l.id); if ((r as any).ok) contacts++; }
  for (const p of ps) { const r = await syncProjectToHubspot(p.id); if ((r as any).ok) deals++; }
  return { contacts, deals };
}
export { and };
