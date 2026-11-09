import "server-only";
import { eq } from "drizzle-orm";
import { db, portalAccess, projects } from "@/lib/db";

/**
 * Resolve a client-portal token. The access row must exist and not be expired, and the project must
 * have its portal switched on. Used by the portal page and by the media route when a client opens a
 * document link (`/api/media/…?portal=<token>`).
 */
export async function loadPortal(token: string) {
  if (!token) return null;
  const access = await db.query.portalAccess.findFirst({ where: eq(portalAccess.token, token) });
  if (!access || (access.expiresAt && access.expiresAt < new Date())) return null;
  const project = await db.query.projects.findFirst({ where: eq(projects.id, access.projectId) });
  if (!project || !project.clientPortalEnabled) return null;
  return { access, project };
}
