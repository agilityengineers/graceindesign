import { eq } from "drizzle-orm";
import { db, proposals } from "@/lib/db";
import { buildProposalPdf } from "@/lib/server/pdf";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await db.query.proposals.findFirst({ where: eq(proposals.token, token) });
  if (!p) return new Response("Not found", { status: 404 });
  const pdf = await buildProposalPdf({ title: p.title, body: p.body, amount: p.amount, recipientName: p.recipientName, status: p.status, signedAt: p.signedAt, signerName: p.signerName, signerIp: p.signerIp });
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="proposal-${p.id}.pdf"`, "cache-control": "private, no-store" } });
}
