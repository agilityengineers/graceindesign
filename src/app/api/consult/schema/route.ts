import { NextResponse } from "next/server";
import { getConsultSchema } from "@/lib/server/consult";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from") || "general";
  return NextResponse.json(await getConsultSchema(from.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "general"));
}
