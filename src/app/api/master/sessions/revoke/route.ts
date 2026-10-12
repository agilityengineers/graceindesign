import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { withCftSignature } from "@/lib/auth/signed-route";
import { revokeUserSessions } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return withCftSignature(req, async (b) => {
    const u = b?.masterUserId ? await db.query.users.findFirst({ where: eq(users.cftUserId, String(b.masterUserId)) }) : null;
    if (u) await revokeUserSessions(u.id);
    return NextResponse.json({ ok: true, revoked: !!u });
  });
}
