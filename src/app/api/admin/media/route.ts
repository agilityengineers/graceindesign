import { NextResponse } from "next/server";
import { desc, ilike, or } from "drizzle-orm";
import { db, media } from "@/lib/db";
import { getCurrentUser, can, type Area } from "@/lib/auth/session";
import { getMediaMap } from "@/lib/data/media";
export const dynamic = "force-dynamic";

// Anyone who edits content with images can browse the library to pick one.
const AREAS: Area[] = ["media", "pages", "services", "posts", "hero", "products", "social", "caribbean"];
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i;

/** Media library listing for the admin image picker. `ref` is what gets stored in content (media://slot keeps pages in sync with the library). */
export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u || !AREAS.some((a) => can(u, a))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  const [rows, map] = await Promise.all([
    db.select().from(media).where(q ? or(ilike(media.name, `%${q}%`), ilike(media.slot, `%${q}%`), ilike(media.subject, `%${q}%`), ilike(media.alt, `%${q}%`)) : undefined).orderBy(desc(media.updatedAt)).limit(400),
    getMediaMap(),
  ]);
  const items = rows
    .filter((m) => (m.mime ? m.mime.startsWith("image/") : true) && !(m.mime == null && !IMAGE_EXT.test(m.name) && !IMAGE_EXT.test(m.url) && !m.slot))
    .map((m) => {
      const preview = (m.slot ? map.get(m.slot) : null) || (m.storageKey ? `/api/media/${m.storageKey}` : m.url);
      return { id: m.id, name: m.name, slot: m.slot, alt: m.alt, source: m.source, preview, ref: m.slot ? `media://${m.slot}` : preview };
    });
  return NextResponse.json({ items });
}
