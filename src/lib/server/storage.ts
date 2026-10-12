/**
 * Media storage: Replit Object Storage when available, local filesystem otherwise.
 * Files are served through /api/media/[...key] so URLs are stable across backends.
 */
import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

type StorageClient = {
  uploadFromBytes(key: string, bytes: Buffer): Promise<{ ok: boolean; error?: unknown }>;
  downloadAsBytes(key: string): Promise<{ ok: boolean; value?: Buffer[]; error?: unknown }>;
  delete(key: string): Promise<{ ok: boolean; error?: unknown }>;
  list(opts?: { prefix?: string }): Promise<{ ok: boolean; value?: { name: string }[]; error?: unknown }>;
};

let replitClient: StorageClient | null | undefined;
async function getReplit(): Promise<StorageClient | null> {
  if (replitClient !== undefined) return replitClient;
  if (!env.isReplit && !env.objectStorageBucket) { replitClient = null; return null; }
  try {
    const mod: any = await import("@replit/object-storage");
    replitClient = new mod.Client(env.objectStorageBucket ? { bucketId: env.objectStorageBucket } : undefined) as StorageClient;
  } catch (e) {
    console.warn("Replit Object Storage unavailable, using local filesystem", (e as Error).message);
    replitClient = null;
  }
  return replitClient;
}

export function safeKey(name: string) {
  return name.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^\/+/, "");
}

export async function putObject(key: string, bytes: Buffer): Promise<{ key: string; url: string }> {
  const k = safeKey(key);
  const client = await getReplit();
  if (client) {
    const res = await client.uploadFromBytes(k, bytes);
    if (!res.ok) throw new Error(`Object storage upload failed: ${String(res.error)}`);
  } else {
    const file = path.join(LOCAL_DIR, k);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  return { key: k, url: `/api/media/${k}` };
}

export async function getObject(key: string): Promise<Buffer | null> {
  const k = safeKey(key);
  const client = await getReplit();
  if (client) {
    const res = await client.downloadAsBytes(k);
    if (!res.ok || !res.value) return null;
    return Buffer.concat(res.value);
  }
  try { return await fs.readFile(path.join(LOCAL_DIR, k)); } catch { return null; }
}

export async function deleteObject(key: string) {
  const k = safeKey(key);
  const client = await getReplit();
  if (client) { await client.delete(k); return; }
  try { await fs.unlink(path.join(LOCAL_DIR, k)); } catch { /* ignore */ }
}

export function mimeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4", ics: "text/calendar" } as Record<string, string>)[ext || ""] || "application/octet-stream";
}
