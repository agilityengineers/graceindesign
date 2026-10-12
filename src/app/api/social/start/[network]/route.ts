import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, can } from "@/lib/auth/session";
import { oauthStartUrl, NETWORKS, type Network } from "@/lib/server/social";
import { randomToken, sign } from "@/lib/server/crypto";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
/** Begin the OAuth dance for a network (admin only). State is signed and pinned to a cookie. */
export async function GET(_req: Request, { params }: { params: Promise<{ network: string }> }) {
  const u = await getCurrentUser();
  if (!u || !can(u, "social")) return NextResponse.redirect(`${env.baseUrl}/login?next=/admin/social`);
  const { network } = await params;
  if (!(NETWORKS as readonly string[]).includes(network)) return NextResponse.redirect(`${env.baseUrl}/admin/social?err=${encodeURIComponent("Unknown network")}`);
  const state = sign(`${network}.${randomToken(12)}`);
  const url = oauthStartUrl(network as Network, encodeURIComponent(state));
  if (!url) return NextResponse.redirect(`${env.baseUrl}/admin/social?err=${encodeURIComponent(`${network} app credentials are not configured — add them under Replit Secrets`)}`);
  const jar = await cookies();
  jar.set("gid_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: 600 });
  return NextResponse.redirect(url);
}
