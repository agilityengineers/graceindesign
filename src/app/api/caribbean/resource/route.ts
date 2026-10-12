import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { submitResource } from "@/lib/server/caribbean";
export const dynamic = "force-dynamic";
const Schema = z.object({ kind: z.enum(["suggestion", "own"]).default("suggestion"), name: z.string().min(2).max(160), category: z.string().min(2).max(80), area: z.string().min(2).max(120), url: z.string().max(300).optional(), email: z.string().email(), description: z.string().min(5).max(2000), website: z.string().optional() });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit("cc:resource:" + ip, 10, 3600)).ok) return NextResponse.json({ ok: false, error: "Too many requests — please try again later." }, { status: 429 });
  let body: z.infer<typeof Schema>; try { body = Schema.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Please check the required fields." }, { status: 400 }); }
  if (!body.website) await submitResource(body);
  return NextResponse.json({ ok: true });
}
