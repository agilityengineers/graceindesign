import { NextResponse, type NextRequest } from "next/server";
/** Pass the request path to server components (used for login redirects) and gate /admin by cookie presence. */
export function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: new Headers(req.headers) } });
  res.headers.set("x-pathname", req.nextUrl.pathname);
  if (req.nextUrl.pathname.startsWith("/admin") && !req.cookies.get("gid_session")) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  }
  const reqHeaders = new Headers(req.headers); reqHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: reqHeaders } });
}
export const config = { matcher: ["/admin/:path*", "/roadmap", "/portal/:path*"] };
