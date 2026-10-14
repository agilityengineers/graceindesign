import { NextResponse } from "next/server";

// Legacy path-bearing credentials are permanently disabled, including already sent links.
export async function GET() {
  return new NextResponse("This old sign-in link is no longer supported. Request a new notification or sign in normally.", {
    status: 410,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
