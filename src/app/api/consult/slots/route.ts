import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/server/consult";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await getAvailableSlots()); }
