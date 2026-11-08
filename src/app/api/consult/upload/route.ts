import { NextResponse } from "next/server";
import { putObject } from "@/lib/server/storage";
import { rateLimit } from "@/lib/server/rate-limit";
import { ACCEPTED_PHOTO_LABEL, PUBLIC_PHOTO_PREFIX, detectImageType } from "@/lib/image-signature";
import { nanoid } from "nanoid";
export const dynamic = "force-dynamic";
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit(`upload:${ip}`, 30, 3600)).ok) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  let fd: FormData;
  try { fd = await req.formData(); } catch { return bad("Bad upload"); }
  const file = fd.get("file");
  if (!(file instanceof File)) return bad("No file");
  if (file.size === 0) return bad("That file is empty.");
  if (file.size > 12 * 1024 * 1024) return bad("File too large (12MB max)");
  // The browser-reported type and the filename are chosen by the uploader, so neither is consulted:
  // the file's own bytes decide its type, and the stored extension follows from that.
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected) return bad(`Please upload a ${ACCEPTED_PHOTO_LABEL} photo.`);
  const { url } = await putObject(`${PUBLIC_PHOTO_PREFIX}${nanoid(10)}.${detected.ext}`, bytes);
  return NextResponse.json({ url });
}
