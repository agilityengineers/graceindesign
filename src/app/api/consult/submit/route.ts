import { NextResponse } from "next/server";
import { z } from "zod";
import { submitConsultation } from "@/lib/server/consult";
import { rateLimit } from "@/lib/server/rate-limit";
export const dynamic = "force-dynamic";
const Body = z.object({ sourcePage: z.string().max(40).default("general"), pathId: z.string().max(40).nullable().optional(), answers: z.record(z.any()).default({}), slotIso: z.string().nullable().optional(), utm: z.record(z.string()).optional(), website: z.string().optional() });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const rl = await rateLimit(`consult:${ip}`, 8, 3600);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests. Please try again later or call (770) 691-1600." }, { status: 429 });
  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Invalid submission." }, { status: 400 }); }
  const res = await submitConsultation({ sourcePage: body.sourcePage.replace(/[^a-z0-9-]/gi, "") || "general", pathId: body.pathId ?? null, answers: body.answers, slotIso: body.slotIso ?? null, utm: body.utm, honeypot: body.website }, { ip });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
