import { and, eq, or } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { getObject, mimeFromName } from "@/lib/server/storage";
import { getCurrentUser, can } from "@/lib/auth/session";
import { loadPortal } from "@/lib/server/portal";
import { classifyMediaKey, isPrivateMedia, portalMayOpen, privateFileHeaders, publicFileHeaders, type MediaKind } from "@/lib/media-access";
import { detectImageType } from "@/lib/image-signature";
export const dynamic = "force-dynamic";

/**
 * Serves stored objects. Site content (library, hero, services, products…) is public and cached for a
 * year. Keys under `leads/` and `projects/` are private: they open for a signed-in team member with the
 * Leads or Projects area, or — lead and project documents only — for a client whose portal token
 * (`?portal=…`) belongs to the project the document is attached to. Nothing is read from storage until
 * the caller is allowed, so a refusal never confirms that a file exists.
 */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const { kind, key } = classifyMediaKey(segments.join("/"));
  if (kind === "invalid") return new Response("Bad key", { status: 400 });
  if (isPrivateMedia(kind)) {
    const refusal = await refusePrivate(req, kind, key);
    if (refusal) return refusal;
  }
  const buf = await getObject(key);
  if (!buf) return new Response("Not found", { status: 404 });
  // Consultation photos: the stored bytes decide the type, never the extension. Anything that isn't a
  // recognised raster image goes out as octet-stream, which privateFileHeaders turns into a download.
  const mime = kind === "lead_photo" ? (detectImageType(buf)?.mime ?? "application/octet-stream") : mimeFromName(key);
  const headers = isPrivateMedia(kind) ? privateFileHeaders(key, mime) : publicFileHeaders(key, mime);
  // Media-library SVGs stay viewable in pages but can't run script when opened directly on this origin.
  if (!isPrivateMedia(kind) && mime === "image/svg+xml") headers["content-security-policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(buf), { headers });
}

/** `null` when the caller may read this private key; otherwise the response to send instead. */
async function refusePrivate(req: Request, kind: MediaKind, key: string): Promise<Response | null> {
  const user = await getCurrentUser();
  if (user) return can(user, "leads") || can(user, "projects") ? null : new Response("Your role can't open client files", { status: 403 });
  const url = new URL(req.url);
  const token = url.searchParams.get("portal");
  if (token && portalMayOpen(kind)) {
    const ctx = await loadPortal(token);
    if (!ctx) return new Response("This portal link is no longer valid", { status: 401 });
    // Lead proposals copied onto a project keep their leads/<id>/ key, so the project link is the documents row, not the prefix.
    const doc = await db.query.documents.findFirst({ where: and(eq(documents.projectId, ctx.project.id), eq(documents.visibleToClient, true), or(eq(documents.storageKey, key), eq(documents.url, `/api/media/${key}`))) });
    return doc ? null : new Response("This file isn't shared with your project", { status: 403 });
  }
  // A team member following a link shared in Slack or email gets the sign-in page and lands on the file afterwards.
  if (!token && req.headers.get("sec-fetch-mode") === "navigate" && req.headers.get("sec-fetch-dest") === "document") {
    return new Response(null, { status: 302, headers: { location: `/login?next=${encodeURIComponent(url.pathname)}`, "cache-control": "no-store" } });
  }
  return new Response("Sign in to open this file", { status: 401, headers: { "cache-control": "no-store" } });
}
