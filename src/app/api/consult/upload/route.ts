import { NextResponse } from "next/server";
import { putObject, mimeFromName } from "@/lib/server/storage";
import { rateLimit } from "@/lib/server/rate-limit";
import { nanoid } from "nanoid";
export const dynamic = "force-dynamic";
/** Consultation-form photos. Stored under leads/photos/, which only the team can open (src/lib/media-access.ts). */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit(`upload:${ip}`, 30, 3600)).ok) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const fd = await req.formData(); const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "File too large (12MB max)" }, { status: 400 });
  const mime = file.type || mimeFromName(file.name);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // SVG is an image format that can carry script, so it is not a photo we accept.
  if (!mime.startsWith("image/") || mime === "image/svg+xml" || ext === "svg") return NextResponse.json({ error: "Photos only (JPG, PNG, WebP, GIF or HEIC)" }, { status: 400 });
  const { url } = await putObject(`leads/photos/${nanoid(10)}.${ext}`, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url });
}
