import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verificationPage } from "@/lib/auth/verification-page";
import { consumeCftLaunchLink } from "@/lib/server/cft-links";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const nonce = randomUUID();
  return new NextResponse(verificationPage(nonce, "/go/cft"), { headers: {
    ...headers, "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  } });
}

export async function POST(req: Request) {
  const invalid = () => NextResponse.json({ location: "/login?err=invalid" }, { headers });
  if (new URL(req.url).search || req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin) return invalid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit(`cftgo:${ip}`, 30, 900)).ok) return invalid();
  let token: unknown;
  try { token = (await req.json()).token; } catch { return invalid(); }
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid();
  const result = await consumeCftLaunchLink(token);
  return result.ok ? NextResponse.json({ location: result.redirectTo }, { headers }) : invalid();
}
