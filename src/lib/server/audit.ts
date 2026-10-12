import { db, auditLog } from "@/lib/db";

export async function audit(userId: number | null | undefined, action: string, entity: string, entityId?: string | number | null, meta?: Record<string, unknown>) {
  try { await db.insert(auditLog).values({ userId: userId ?? null, action, entity, entityId: entityId == null ? null : String(entityId), meta }); } catch (e) { console.warn("audit failed", e); }
}
