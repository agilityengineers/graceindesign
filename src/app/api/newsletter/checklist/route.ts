import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { sendChecklistLead } from "@/lib/server/walkthrough";
import { WALKTHROUGH_PAGE_PATH } from "@/lib/walkthrough";
export const dynamic = "force-dynamic";
const schema = z.object({ firstName: z.string().trim().min(1).max(100), email: z.string().trim().email(), website: z.string().optional() });
/** The WELLness Resources lead magnet: first name + email in, the download page out (the email with the link follows). */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit("checklist:" + ip, 5, 3600)).ok) return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  let body: z.infer<typeof schema>; try { body = schema.parse(await req.json()); } catch { return NextResponse.json({ ok: false, error: "Please enter your first name and a valid email." }, { status: 400 }); }
  // The honeypot swallows bots silently; they get the same answer as a person.
  if (!body.website) await sendChecklistLead({ firstName: body.firstName, email: body.email }, { ip: ip === "anon" ? null : ip, page: req.headers.get("referer") });
  return NextResponse.json({ ok: true, next: WALKTHROUGH_PAGE_PATH });
}
