/** CFT → child: create-or-link { masterUserId, email, firstName, lastName, role, isActive } */
import { NextResponse } from "next/server";
import { withCftSignature } from "@/lib/auth/signed-route";
import { upsertCftUser } from "@/lib/auth/cft-sso";
import { audit } from "@/lib/server/audit";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return withCftSignature(req, async (b) => {
    if (!b?.masterUserId || !b?.email) return NextResponse.json({ error: "masterUserId and email required" }, { status: 400 });
    const u = await upsertCftUser({ masterUserId: String(b.masterUserId), email: String(b.email), firstName: b.firstName, lastName: b.lastName, role: String(b.role || "client"), isActive: b.isActive !== false });
    await audit(null, "cft_provision", "user", u.id, { masterUserId: b.masterUserId, role: b.role });
    return NextResponse.json({ ok: true, userId: u.id, role: u.role });
  });
}
