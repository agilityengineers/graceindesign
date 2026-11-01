import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db, sessions, users, type User, type UserRole } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sign, unsign } from "@/lib/server/crypto";

export const SESSION_COOKIE = "gid_session";
const SESSION_DAYS = 30;

export async function createSession(userId: number, source: "magic_link" | "cft_sso" = "magic_link") {
  const id = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ id, userId, expiresAt, source, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null, userAgent: h.get("user-agent")?.slice(0, 300) || null });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(id), { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", expires: expiresAt });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const id = unsign(raw);
  if (id) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, id));
  jar.delete(SESSION_COOKIE);
}

export async function revokeUserSessions(userId: number) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/** Current user (cached per request). Returns null when signed out. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const id = unsign(jar.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const row = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.isActive, true))).limit(1);
  return row[0]?.user ?? null;
});

/** Permission matrix from design/Roadmap.dc.html "Roles & permissions". */
export type Area = "leads" | "calendar" | "projects" | "forms" | "pages" | "services" | "posts" | "media" | "products" | "social" | "users" | "integrations" | "caribbean" | "newsletter" | "hero" | "rss" | "ops" | "dashboard";
const MATRIX: Record<UserRole, Area[]> = {
  owner: ["leads", "calendar", "projects", "forms", "pages", "services", "posts", "media", "products", "social", "users", "integrations", "caribbean", "newsletter", "hero", "rss", "ops", "dashboard"],
  editor: ["pages", "services", "posts", "media", "products", "caribbean", "newsletter", "hero", "rss", "dashboard"],
  sales: ["leads", "calendar", "projects", "ops", "dashboard"],
  social: ["posts", "media", "social", "dashboard"],
};
export function can(user: Pick<User, "role" | "isSuperAdmin"> | null, area: Area) {
  if (!user) return false;
  if (user.isSuperAdmin || user.role === "owner") return true;
  return MATRIX[user.role]?.includes(area) ?? false;
}
export function areasFor(user: Pick<User, "role" | "isSuperAdmin">) { return user.isSuperAdmin ? MATRIX.owner : MATRIX[user.role]; }

export class AuthError extends Error { status = 401; constructor(msg = "Not signed in") { super(msg); } }
export class ForbiddenError extends Error { status = 403; constructor(msg = "Not allowed") { super(msg); } }

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError();
  return u;
}
export async function requireArea(area: Area): Promise<User> {
  const u = await requireUser();
  if (!can(u, area)) throw new ForbiddenError(`Your role (${u.role}) can't access ${area}.`);
  return u;
}
export async function requireOwner(): Promise<User> {
  const u = await requireUser();
  if (!(u.role === "owner" || u.isSuperAdmin)) throw new ForbiddenError("Owner access required.");
  return u;
}

/** `?preview=1` shows draft content — only for signed-in team members. */
export async function canPreview(sp: { preview?: string } | undefined) {
  if (!sp || sp.preview !== "1") return false;
  const u = await getCurrentUser();
  return !!u;
}
