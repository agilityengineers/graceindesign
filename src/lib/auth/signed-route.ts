import "server-only";
import { NextResponse } from "next/server";
import { verifySignedRequest, ssoConfigured } from "@/lib/auth/cft-sso";
/** Wrap a CFT→child signed request handler: uniform 401 on any failure. */
export async function withCftSignature(req: Request, handler: (body: any) => Promise<Response>) {
  if (!ssoConfigured()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = await req.text();
  const v = verifySignedRequest(req.headers, raw);
  if (!v.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: any = {}; if (raw) { try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); } }
  return handler(body);
}
