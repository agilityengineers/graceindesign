import "server-only";
import fs from "fs";
import path from "path";
import { cache } from "react";
import { db, media } from "@/lib/db";

const PUBLIC_MEDIA = path.join(process.cwd(), "public", "media");
let localFiles: Set<string> | null = null;
function localFileFor(slot: string): string | null {
  if (!localFiles) { try { localFiles = new Set(fs.readdirSync(PUBLIC_MEDIA)); } catch { localFiles = new Set(); } }
  for (const ext of ["jpg", "jpeg", "png", "webp"]) { const f = `${slot}.${ext}`; if (localFiles.has(f)) return `/media/${f}`; }
  return null;
}

export type MediaMap = Map<string, string>;

/** slot → best available URL (uploaded object → local fetched file → brand asset / remote placeholder). */
export const getMediaMap = cache(async (): Promise<MediaMap> => {
  const rows = await db.select({ slot: media.slot, url: media.url, storageKey: media.storageKey, remoteUrl: media.remoteUrl, source: media.source }).from(media);
  const map: MediaMap = new Map();
  for (const r of rows) {
    if (!r.slot) continue;
    const local = localFileFor(r.slot);
    const url = r.storageKey ? `/api/media/${r.storageKey}` : local ?? (r.url && !r.url.startsWith("http") ? r.url : null) ?? r.url ?? r.remoteUrl ?? "";
    map.set(r.slot, url || placeholderUrl(r.slot));
  }
  return map;
});

export function placeholderUrl(label: string) { return `/api/placeholder?label=${encodeURIComponent(label)}`; }

export function resolveImg(map: MediaMap, ref: string | null | undefined): string {
  if (!ref) return placeholderUrl("image");
  if (ref.startsWith("media://")) { const slot = ref.slice(8); return map.get(slot) ?? placeholderUrl(slot); }
  return ref;
}

/** Deep-resolve any `media://` strings inside block content. */
export function resolveDeep<T>(map: MediaMap, value: T): T {
  if (typeof value === "string") return (value.startsWith("media://") ? resolveImg(map, value) : value) as T;
  if (Array.isArray(value)) return value.map((v) => resolveDeep(map, v)) as T;
  if (value && typeof value === "object") { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveDeep(map, v); return out as T; }
  return value;
}
