/** CFT Connected Apps — launch endpoint. GET /api/sso/launch?token=<payloadB64>.<sig> */
import { NextResponse } from "next/server";
import { verifyLaunchToken, burnJti, upsertCftUser, ssoConfigured } from "@/lib/auth/cft-sso";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { audit } from "@/lib/server/audit";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!ssoConfigured()) return NextResponse.redirect(`${env.baseUrl}/login?err=sso`);
  const v = verifyLaunchToken(token);
  if (!v.ok) { await audit(null, "sso_denied", "user", null, { reason: v.reason }); return NextResponse.redirect(`${env.baseUrl}/login?err=sso`); }
  if (!(await burnJti(v.payload.jti, v.payload.exp))) return NextResponse.redirect(`${env.baseUrl}/login?err=sso`);
  const user = await upsertCftUser({ masterUserId: v.payload.sub, email: v.payload.email, firstName: v.payload.firstName, lastName: v.payload.lastName, name: v.payload.name, role: v.payload.role, isActive: true });
  if (!user.isActive) return NextResponse.redirect(`${env.baseUrl}/login?err=sso`);
  await createSession(user.id, "cft_sso");
  await audit(user.id, "sso_launch", "user", user.id, { target: v.payload.target });
  const target = v.payload.target && v.payload.target.startsWith("/") ? v.payload.target : "/admin";
  return NextResponse.redirect(`${env.baseUrl}${target}`);
}
