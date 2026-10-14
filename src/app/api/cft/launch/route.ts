/**
 * GET /api/cft/launch — "Open in Call Flow Tracker" for a signed-in team member. Mints a CFT SSO
 * token for *their own* account (matched in CFT by email on first use) and redirects.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { buildCftEntryUrl, personFromUser } from "@/lib/server/cft-master";
import { audit } from "@/lib/server/audit";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store, max-age=0", "referrer-policy": "no-referrer" };

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${env.baseUrl}/login?next=${encodeURIComponent("/api/cft/launch")}`, { headers: noStore });
  if (!env.cft.url) return NextResponse.redirect(`${env.baseUrl}/admin?err=cft`, { headers: noStore });
  const target = new URL(req.url).searchParams.get("target");
  const to = buildCftEntryUrl(personFromUser(user))!;
  await audit(user.id, "cft_launch", "user", user.id, { target });
  return NextResponse.redirect(to, { headers: noStore });
}
