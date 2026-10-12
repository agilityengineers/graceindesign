import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const res = await consumeMagicLink(token);
  if (!res) return NextResponse.redirect(`${env.baseUrl}/login?err=invalid`);
  await createSession(res.user.id, "magic_link");
  return NextResponse.redirect(`${env.baseUrl}${res.redirectTo.startsWith("/") ? res.redirectTo : "/admin"}`);
}
