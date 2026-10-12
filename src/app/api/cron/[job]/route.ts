import { NextResponse } from "next/server";
import { runJob, JOBS, type Job } from "@/lib/server/cron";
import { env } from "@/lib/env";
import { timingSafeEqual } from "@/lib/server/crypto";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function handle(req: Request, params: Promise<{ job: string }>) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("token") || "";
  if (!token || !timingSafeEqual(token, env.cronSecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await params;
  if (!JOBS.includes(job as Job)) return NextResponse.json({ error: `unknown job; one of ${JOBS.join(", ")}` }, { status: 400 });
  try { return NextResponse.json({ ok: true, job, result: await runJob(job as Job) }); }
  catch (e: any) { return NextResponse.json({ ok: false, job, error: String(e?.message || e) }, { status: 500 }); }
}
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) { return handle(req, params); }
export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) { return handle(req, params); }
