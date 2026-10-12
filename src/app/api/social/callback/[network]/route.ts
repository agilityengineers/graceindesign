import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, can } from "@/lib/auth/session";
import { exchangeOauthCode, saveConnectedAccount, NETWORKS, type Network } from "@/lib/server/social";
import { unsign } from "@/lib/server/crypto";
import { audit } from "@/lib/server/audit";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ network: string }> }) {
  const u = await getCurrentUser();
  if (!u || !can(u, "social")) return NextResponse.redirect(`${env.baseUrl}/login?next=/admin/social`);
  const { network } = await params;
  const url = new URL(req.url);
  const fail = (msg: string) => NextResponse.redirect(`${env.baseUrl}/admin/social?err=${encodeURIComponent(msg)}`);
  if (!(NETWORKS as readonly string[]).includes(network)) return fail("Unknown network");
  if (url.searchParams.get("error")) return fail(`${network} refused: ${url.searchParams.get("error_description") || url.searchParams.get("error")}`);
  const jar = await cookies();
  const expected = jar.get("gid_oauth_state")?.value; jar.delete("gid_oauth_state");
  const got = url.searchParams.get("state") || "";
  if (!expected || got !== expected || !unsign(expected)?.startsWith(`${network}.`)) return fail("Sign-in state mismatch — try connecting again");
  const code = url.searchParams.get("code"); if (!code) return fail("No authorization code returned");
  const t = await exchangeOauthCode(network as Network, code);
  if (!t) return fail(`Could not complete the ${network} connection (check app credentials and permissions)`);
  await saveConnectedAccount(network as Network, t);
  await audit(u.id, "connect", "social_account", network, { displayName: t.displayName });
  return NextResponse.redirect(`${env.baseUrl}/admin/social?ok=${encodeURIComponent(`${t.displayName || network} connected`)}`);
}
