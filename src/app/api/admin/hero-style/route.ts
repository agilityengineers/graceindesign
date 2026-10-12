import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, pages, services } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u || !can(u, "hero")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind, id, style } = await req.json();
  if (!["classic", "cinematic"].includes(style)) return NextResponse.json({ error: "Bad style" }, { status: 400 });
  if (kind === "page") await db.update(pages).set({ heroStyle: style, updatedAt: new Date() }).where(eq(pages.key, String(id)));
  else await db.update(services).set({ heroStyle: style, updatedAt: new Date() }).where(eq(services.slug, String(id)));
  await audit(u.id, "update", kind === "page" ? "page" : "service", String(id), { heroStyle: style });
  return NextResponse.json({ ok: true });
}
