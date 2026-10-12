import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/server/stripe";
import { db, webhookEvents } from "@/lib/db";
export const dynamic = "force-dynamic";
/** Stripe → invoice.paid marks the matching invoice paid (metadata.gid_invoice_id). */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  try {
    const r = await handleStripeWebhook(raw, sig);
    const type = (r as { received?: string }).received || "ignored";
    await db.insert(webhookEvents).values({ source: "stripe", dedupeKey: `stripe:${req.headers.get("stripe-signature")?.slice(0, 60) || Date.now()}:${type}`, eventType: type, status: "processed", processedAt: new Date() }).onConflictDoNothing();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    await db.insert(webhookEvents).values({ source: "stripe", dedupeKey: `stripe:err:${Date.now()}`, eventType: "error", status: "failed", error: String(e?.message || e).slice(0, 300) }).onConflictDoNothing();
    return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
  }
}
