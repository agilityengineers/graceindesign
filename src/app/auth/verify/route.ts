import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { verificationPage } from "@/lib/auth/verification-page";
import { randomUUID } from "node:crypto";
export const dynamic = "force-dynamic";
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

// No layout, analytics, framework hydration, or subresources can run before
// the first inline script removes the credential from this history entry.
export async function GET() {
  const nonce = randomUUID();
  return new NextResponse(verificationPage(nonce), {
    headers: {
      ...privateHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    },
  });
}

export async function POST(req: Request) {
  const invalid = () => NextResponse.json({ location: `${env.baseUrl}/login?err=invalid` }, { headers: privateHeaders });
  // A JSON-only body prevents cross-origin HTML form submissions. No CORS is enabled.
  if (new URL(req.url).search || req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return invalid();
  let token: unknown;
  try { token = (await req.json())?.token; } catch { return invalid(); }
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid();
  const res = await consumeMagicLink(token);
  if (!res) return invalid();
  await createSession(res.user.id, "magic_link");
  return NextResponse.json({
    location: `${env.baseUrl}${res.redirectTo.startsWith("/") ? res.redirectTo : "/admin"}`,
  }, { headers: privateHeaders });
}
