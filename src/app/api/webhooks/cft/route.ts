import { NextResponse } from "next/server";
import { verifyCftSignature, processCftEvent } from "@/lib/server/cft-inbound";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyCftSignature(req.headers, raw)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  try { const r = await processCftEvent(raw); return NextResponse.json({ ok: true, ...r }); }
  catch (e: any) { return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 }); }
}
