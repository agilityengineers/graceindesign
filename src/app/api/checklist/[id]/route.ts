import { eq } from "drizzle-orm";
import { db, bookings, leads, paths } from "@/lib/db";
import { buildChecklistPdf } from "@/lib/server/pdf";
import { fmtWhen } from "@/lib/server/consult";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const e = new URL(req.url).searchParams.get("e") || "";
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, Number(id)) }); if (!b) return new Response("Not found", { status: 404 });
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, b.leadId) }); if (!lead || (lead.email || "").toLowerCase() !== e.toLowerCase()) return new Response("Not found", { status: 404 });
  const path = lead.pathId ? await db.query.paths.findFirst({ where: eq(paths.id, lead.pathId) }) : null;
  const pdf = await buildChecklistPdf({ name: lead.name, pathLabel: path?.label || "Consultation", consultType: (path?.consultType || "15-min discovery call").replace(/^15-min /, "15-minute "), when: fmtWhen(b.startsAt) });
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="pre-consult-checklist.pdf"` } });
}
