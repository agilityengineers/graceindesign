import "server-only";
/**
 * Magnific (Freepik) image generation for the media library. Uses the Freepik REST API
 * (the same platform behind Magnific); needs MAGNIFIC_API_KEY. Returns raw image bytes.
 */
import { env } from "@/lib/env";

export function magnificConfigured() { return !!env.magnificApiKey; }

const SIZE: Record<string, string> = { "16:9": "widescreen_16_9", "4:3": "classic_4_3", "3:2": "classic_4_3", "1:1": "square_1_1", "2:3": "portrait_2_3", "9:16": "social_story_9_16" };

export async function generateImage(opts: { prompt: string; aspect?: string; negative?: string }): Promise<{ bytes: Buffer; mime: string; creationId: string | null }> {
  if (!magnificConfigured()) throw new Error("MAGNIFIC_API_KEY is not set — add it under Replit Secrets to generate images");
  const body = { prompt: opts.prompt, negative_prompt: opts.negative || "text, watermark, logo, blurry, distorted hands", num_images: 1, image: { size: SIZE[opts.aspect || "16:9"] || "widescreen_16_9" }, styling: { style: "photo", lighting: "warm", framing: "cinematic" }, filter_nsfw: true };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 90000);
  let res: Response;
  try {
    res = await fetch("https://api.freepik.com/v1/ai/text-to-image", { method: "POST", headers: { "content-type": "application/json", "x-freepik-api-key": env.magnificApiKey }, body: JSON.stringify(body), signal: ctrl.signal });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Magnific/Freepik API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  const first = json?.data?.[0];
  if (!first?.base64) throw new Error("Magnific returned no image");
  return { bytes: Buffer.from(first.base64, "base64"), mime: "image/png", creationId: json?.meta?.id ? String(json.meta.id) : null };
}
