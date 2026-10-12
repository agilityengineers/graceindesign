"use server";
import { eq } from "drizzle-orm";
import { db, media } from "@/lib/db";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum } from "@/lib/utils";
import { uploadToMedia } from "@/lib/server/media-upload";
import { putObject, deleteObject } from "@/lib/server/storage";
import { generateImage } from "@/lib/server/magnific";

const REVAL = ["/admin/content/media", "/", "/about", "/services", "/healthy-home-resources", "/caribbean-connection", "/news"];

export async function uploadMedia(formData: FormData) {
  await adminAction("media", "media", "upload", async (user) => {
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Choose at least one file");
    const slot = strOrNull(formData.get("slot"));
    let last = 0;
    for (const [i, f] of files.entries()) last = (await uploadToMedia(f, { folder: "library", usedOn: [], slot: i === 0 ? slot : null, alt: strOrNull(formData.get("alt")), userId: user.id })).id;
    return last;
  }, { back: "/admin/content/media", ok: "Uploaded to the media library", entityId: (id) => id, revalidate: REVAL });
}
export async function mediaAction(formData: FormData) {
  const id = parseNum(formData.get("mediaId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/content/media");
  await adminAction("media", "media", op, async () => {
    const m = await db.query.media.findFirst({ where: eq(media.id, id) }); if (!m) throw new Error("Media not found");
    if (op === "delete") { if (m.storageKey) await deleteObject(m.storageKey).catch(() => {}); await db.delete(media).where(eq(media.id, id)); }
    else if (op === "update") await db.update(media).set({ name: str(formData.get("name")) || m.name, alt: strOrNull(formData.get("alt")), slot: strOrNull(formData.get("slot")), updatedAt: new Date() }).where(eq(media.id, id));
    else if (op === "replace") { const f = formData.get("file"); if (!(f instanceof File) || f.size === 0) throw new Error("Choose a file"); const { url, key } = await putObject(`library/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`, Buffer.from(await f.arrayBuffer())); if (m.storageKey) await deleteObject(m.storageKey).catch(() => {}); await db.update(media).set({ url, storageKey: key, mime: f.type || m.mime, size: f.size, name: f.name, source: "upload", updatedAt: new Date() }).where(eq(media.id, id)); }
    return id;
  }, { back, ok: op === "delete" ? "Media deleted" : op === "replace" ? "Image replaced everywhere it's used" : "Media updated", entityId: () => id, revalidate: REVAL });
}
export async function generateMedia(formData: FormData) {
  await adminAction("media", "media", "generate", async () => {
    const prompt = str(formData.get("prompt")); if (!prompt) throw new Error("Describe the image you want");
    const slot = strOrNull(formData.get("slot"));
    const aspect = str(formData.get("aspect")) || "16:9";
    const { bytes, mime, creationId } = await generateImage({ prompt, aspect });
    const key = `generated/${Date.now()}-${(slot || "image").replace(/[^a-zA-Z0-9._-]/g, "_")}.png`;
    const { url, key: storedKey } = await putObject(key, bytes);
    const existing = slot ? await db.query.media.findFirst({ where: eq(media.slot, slot) }) : null;
    if (existing) { await db.update(media).set({ url, storageKey: storedKey, mime, size: bytes.length, source: "magnific", magnificCreationId: creationId, subject: prompt, updatedAt: new Date() }).where(eq(media.id, existing.id)); return existing.id; }
    const [row] = await db.insert(media).values({ name: `${slot || "generated"}.png`, url, storageKey: storedKey, mime, size: bytes.length, slot, subject: prompt, aspect, source: "magnific", magnificCreationId: creationId }).returning();
    return row.id;
  }, { back: "/admin/content/media", ok: "Image generated and saved", entityId: (id) => id, revalidate: REVAL });
}
