/**
 * GET /go/cft/<token> — the link texted/Slacked to Grace. Checks the link, mints a fresh two-minute
 * Call Flow Tracker SSO token for her and redirects, so she lands in CFT already signed in.
 * Anything wrong sends her to CFT's normal login page (or this app's login when CFT isn't set up).
 */
import { NextResponse } from "next/server";
import { consumeCftLaunchLink } from "@/lib/server/cft-links";
import { audit } from "@/lib/server/audit";
import { rateLimit } from "@/lib/server/rate-limit";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store, max-age=0", "referrer-policy": "no-referrer" };

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit(`cftgo:${ip}`, 30, 900)).ok) return NextResponse.redirect(`${env.baseUrl}/login?err=rate`, { headers: noStore });
  const { token } = await params;
  const r = await consumeCftLaunchLink(token);
  if (!r.ok) {
    await audit(null, "cft_link_denied", "cft_launch_link", null, { reason: r.reason });
    const fallback = env.cft.url ? `${env.cft.url}/login` : `${env.baseUrl}/login?err=cft`;
    return NextResponse.redirect(fallback, { headers: noStore });
  }
  await audit(r.person.id ?? null, "cft_link_launch", "cft_launch_link", null, { email: r.person.email, target: r.target, sso: r.sso });
  return NextResponse.redirect(r.redirectTo, { headers: noStore });
}
