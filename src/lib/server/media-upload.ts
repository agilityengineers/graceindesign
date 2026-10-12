import "server-only";
import { eq } from "drizzle-orm";
import { db, media } from "@/lib/db";
import { putObject, mimeFromName, safeKey } from "@/lib/server/storage";

const MAX_BYTES = 15 * 1024 * 1024;

/** Store an uploaded file and register it in the media library. Returns the served URL. */
export async function uploadToMedia(file: File, opts: { folder: string; usedOn?: string[]; slot?: string | null; alt?: string | null; userId?: number | null; subject?: string | null }) {
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file first");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 15 MB");
  const mime = file.type || mimeFromName(file.name);
  const key = `${opts.folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${safeKey(file.name)}`;
  const { url, key: storedKey } = await putObject(key, Buffer.from(await file.arrayBuffer()));
  if (opts.slot) {
    // Replacing a slot: point the existing media row at the new file so every page using media://slot updates.
    const existing = await db.query.media.findFirst({ where: eq(media.slot, opts.slot) });
    if (existing) { await db.update(media).set({ url, storageKey: storedKey, mime, size: file.size, name: file.name, source: "upload", updatedAt: new Date() }).where(eq(media.id, existing.id)); return { url, id: existing.id, key: storedKey }; }
  }
  const [row] = await db.insert(media).values({ name: file.name, url, storageKey: storedKey, mime, size: file.size, alt: opts.alt ?? null, slot: opts.slot ?? null, subject: opts.subject ?? null, usedOn: opts.usedOn ?? [], source: "upload" }).returning();
  return { url, id: row.id, key: storedKey };
}
