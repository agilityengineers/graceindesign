import { getObject, mimeFromName } from "@/lib/server/storage";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const k = key.join("/");
  if (k.includes("..")) return new Response("Bad key", { status: 400 });
  const buf = await getObject(k);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": mimeFromName(k), "cache-control": "public, max-age=31536000, immutable" } });
}
