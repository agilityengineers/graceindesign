import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { sendChecklistLead } from "@/lib/server/caribbean";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit("checklist:" + ip, 5, 3600)).ok) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  let body: { email: string; website?: string }; try { body = z.object({ email: z.string().email(), website: z.string().optional() }).parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 }); }
  if (!body.website) await sendChecklistLead(body.email, { ip: ip === "anon" ? null : ip, page: req.headers.get("referer") });
  return NextResponse.json({ ok: true });
}
