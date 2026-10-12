/** Used by CFT "Test connection" (signed GET) and for lightweight health. */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, leads, bookings, projects } from "@/lib/db";
import { verifySignedRequest, ssoConfigured } from "@/lib/auth/cft-sso";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!ssoConfigured() || !verifySignedRequest(req.headers, "").ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [[l], [b], [p]] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(leads).where(sql`${leads.createdAt} > now() - interval '30 days'`),
    db.select({ n: sql<number>`count(*)` }).from(bookings).where(sql`${bookings.startsAt} > now() and ${bookings.status} = 'booked'`),
    db.select({ n: sql<number>`count(*)` }).from(projects).where(sql`${projects.status} = 'active'`),
  ]);
  return NextResponse.json({ app: "graceindesign", ok: true, metrics: { leads30d: Number(l.n), upcomingBookings: Number(b.n), activeProjects: Number(p.n) } });
}
