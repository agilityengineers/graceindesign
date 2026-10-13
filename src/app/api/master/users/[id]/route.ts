/** CFT → child: PATCH { isActive } (deactivate / reactivate a linked person). */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { withCftSignature } from "@/lib/auth/signed-route";
import { revokeUserSessions } from "@/lib/auth/session";
import { revokeCftLaunchLinks } from "@/lib/server/cft-links";
import { audit } from "@/lib/server/audit";
export const dynamic = "force-dynamic";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withCftSignature(req, async (b) => {
    const u = await db.query.users.findFirst({ where: eq(users.cftUserId, id) });
    if (!u) return NextResponse.json({ ok: true, linked: false });
    if (u.isSuperAdmin) return NextResponse.json({ ok: true, linked: true, protected: true });
    const isActive = b?.isActive !== false;
    await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, u.id));
    if (!isActive) { await revokeUserSessions(u.id); await revokeCftLaunchLinks(u.id); }
    await audit(null, isActive ? "cft_reactivate" : "cft_deactivate", "user", u.id);
    return NextResponse.json({ ok: true, linked: true });
  });
}
