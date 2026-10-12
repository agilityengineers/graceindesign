import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function POST() { await destroySession(); return NextResponse.redirect(`${env.baseUrl}/login`, { status: 303 }); }
export async function GET() { await destroySession(); return NextResponse.redirect(`${env.baseUrl}/login`, { status: 303 }); }
