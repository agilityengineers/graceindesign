import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { subscribeCaribbean } from "@/lib/server/caribbean";
export const dynamic = "force-dynamic";
const Schema = z.object({ email: z.string().email(), segment: z.string().min(2).max(120), location: z.string().max(120).optional(), website: z.string().optional() });
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit("cc:subscribe:" + ip, 10, 3600)).ok) return NextResponse.json({ ok: false, error: "Too many requests — please try again later." }, { status: 429 });
  let body: z.infer<typeof Schema>; try { body = Schema.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Please check the required fields." }, { status: 400 }); }
  if (!body.website) await subscribeCaribbean(body, { ip: ip === "anon" ? null : ip, page: req.headers.get("referer") });
  return NextResponse.json({ ok: true });
}
