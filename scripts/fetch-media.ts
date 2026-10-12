/**
 * Download generated/stock imagery into public/media/<slot>.<ext> so the site self-hosts it.
 *   npm run media:fetch                  # uses MAGNIFIC_API_KEY to resolve fresh URLs for each creation id
 *   npm run media:fetch -- --from urls.json   # or a JSON map { slot: url } you export from Magnific
 *   npm run media:fetch -- --stock       # fall back to the prototype's stock placeholder URLs
 * Run this where outbound HTTPS to Magnific / Freepik CDNs is allowed (e.g. the Replit workspace).
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { MEDIA_SLOTS } from "../src/lib/seed-data/media";

const OUT = path.join(process.cwd(), "public", "media");
const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const stock = args.includes("--stock");

async function resolveMagnificUrl(creationId: string): Promise<string | null> {
  const key = process.env.MAGNIFIC_API_KEY;
  if (!key) return null;
  // Magnific / Freepik API: creation lookup. Adjust the endpoint if your plan exposes a different base URL.
  const endpoints = [`https://api.magnific.com/v1/creations/${creationId}`, `https://api.freepik.com/v1/ai/creations/${creationId}`];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { "x-magnific-api-key": key, "x-freepik-api-key": key, authorization: `Bearer ${key}` } });
      if (!res.ok) continue;
      const j: any = await res.json();
      const u = j?.url || j?.data?.url || j?.results?.url || j?.data?.results?.url;
      if (u) return u;
    } catch { /* try next */ }
  }
  return null;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const provided: Record<string, string> = fromIdx >= 0 ? JSON.parse(await fs.readFile(args[fromIdx + 1], "utf8")) : {};
  let ok = 0, skipped = 0, failed = 0;
  for (const m of MEDIA_SLOTS) {
    if (m.brand) continue;
    const existing = (await fs.readdir(OUT)).find((f) => f.startsWith(m.slot + "."));
    if (existing && !args.includes("--overwrite")) { skipped++; continue; }
    let url = provided[m.slot] || null;
    if (!url && !stock && m.magnificId) url = await resolveMagnificUrl(m.magnificId);
    if (!url && (stock || !m.magnificId)) url = m.remote || null;
    if (!url) { console.warn(`skip ${m.slot}: no URL (set MAGNIFIC_API_KEY, pass --from, or --stock)`); failed++; continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      await fs.writeFile(path.join(OUT, `${m.slot}.${ext}`), buf);
      console.log(`✓ ${m.slot}.${ext} (${Math.round(buf.length / 1024)} KB)`);
      ok++;
    } catch (e: any) { console.warn(`✗ ${m.slot}: ${e.message}`); failed++; }
  }
  console.log(`Done. ${ok} fetched, ${skipped} already present, ${failed} failed.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
