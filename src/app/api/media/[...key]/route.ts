import { getObject, mimeFromName } from "@/lib/server/storage";
import { detectImageType, isPublicPhotoKey } from "@/lib/image-signature";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const k = key.join("/");
  if (k.includes("..")) return new Response("Bad key", { status: 400 });
  const buf = await getObject(k);
  if (!buf) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = { "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" };
  // The stored name minus the upload timestamp, so a saved PDF is "walkthrough.pdf" rather than a bare key. Keys are already safe ASCII.
  const filename = (k.split("/").pop() || "file").replace(/^\d{13}-/, "").replace(/"/g, "");
  let disposition = "inline";
  if (isPublicPhotoKey(k)) {
    // Photos from the public consultation form: the bytes decide the type, never the extension.
    // Anything that isn't a recognised raster image is handed over as a download so the browser
    // never renders it (an SVG served from this origin could run script against an admin session).
    const detected = detectImageType(buf);
    if (detected) headers["content-type"] = detected.mime;
    else { headers["content-type"] = "application/octet-stream"; disposition = "attachment"; }
  } else {
    headers["content-type"] = mimeFromName(k);
  }
  headers["content-disposition"] = `${disposition}; filename="${filename}"`;
  // SVGs from the media library stay viewable but can't run script when opened directly.
  if (headers["content-type"] === "image/svg+xml") headers["content-security-policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
  return new Response(new Uint8Array(buf), { headers });
}
