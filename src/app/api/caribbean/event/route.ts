import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { submitEvent } from "@/lib/server/caribbean";
export const dynamic = "force-dynamic";
const Schema = z.object({ title: z.string().min(3).max(160), date: z.string().min(8), time: z.string().max(60).optional(), format: z.enum(["in_person", "virtual", "hybrid"]), where: z.string().max(200).optional(), host: z.string().min(2).max(160), email: z.string().email(), description: z.string().min(5).max(2000), url: z.string().max(300).optional(), cost: z.string().max(40).optional(), website: z.string().optional() });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit("cc:event:" + ip, 10, 3600)).ok) return NextResponse.json({ ok: false, error: "Too many requests — please try again later." }, { status: 429 });
  let body: z.infer<typeof Schema>; try { body = Schema.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Please check the required fields." }, { status: 400 }); }
  if (!body.website) await submitEvent(body);
  return NextResponse.json({ ok: true });
}
