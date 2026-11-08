import { getObject, mimeFromName } from "@/lib/server/storage";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const k = key.join("/");
  if (k.includes("..")) return new Response("Bad key", { status: 400 });
  const buf = await getObject(k);
  if (!buf) return new Response("Not found", { status: 404 });
  // The stored name minus the upload timestamp, so a saved PDF is "walkthrough.pdf" rather than a bare key. Keys are already safe ASCII.
  const filename = (k.split("/").pop() || "file").replace(/^\d{13}-/, "").replace(/"/g, "");
  return new Response(new Uint8Array(buf), { headers: { "content-type": mimeFromName(k), "content-disposition": `inline; filename="${filename}"`, "cache-control": "public, max-age=31536000, immutable" } });
}
