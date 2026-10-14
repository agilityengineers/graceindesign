import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import SiteFrame from "@/components/site/SiteFrame";
import { db, bookings, leads, paths } from "@/lib/db";
import { fmtWhen } from "@/lib/server/consult";
import { Check } from "@/components/ui/Icons";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your consultation", robots: { index: false, follow: false } };
export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id } = await params; const { e } = await searchParams;
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, Number(id)) }); if (!b) notFound();
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, b.leadId) }); if (!lead || !e || lead.email?.toLowerCase() !== e.toLowerCase()) notFound();
  const path = lead.pathId ? await db.query.paths.findFirst({ where: eq(paths.id, lead.pathId) }) : null;
  const consultType = (path?.consultType || "15-min discovery call").replace(/^15-min /, "15-minute ");
  return (
    <SiteFrame label="Your consultation" active="none" sourceKey="general">
      <section className="gx" style={{ paddingTop: 88, paddingBottom: 104, maxWidth: 760 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Check size={30} /></div>
        <span className="eyebrow">Booking details</span>
        <h1 className="h1" style={{ margin: "14px 0 18px" }}>{b.status === "cancelled" ? "This consultation was cancelled." : "You're booked."}</h1>
        <p className="lede">{consultType} with Grace A. Williams · <strong>{fmtWhen(b.startsAt)}</strong>{lead.phone ? ` · we'll call ${lead.phone}` : ""}.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
          <a className="btn btn-navy" href={`/api/ics/${b.id}?e=${encodeURIComponent(lead.email || "")}`}>Add to calendar (.ics)</a>
          <a className="btn btn-ghost" href={`/api/checklist/${b.id}?e=${encodeURIComponent(lead.email || "")}`}>Pre-consult checklist (PDF)</a>
        </div>
        <p style={{ marginTop: 28, fontSize: 14, color: "#6b7486", lineHeight: 1.7 }}>Need to change the time? Reply to your confirmation email or call (770) 691-1600.</p>
      </section>
    </SiteFrame>
  );
}
