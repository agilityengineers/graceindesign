import SiteFrame from "@/components/site/SiteFrame";
export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
/** Takes the address off both website lists and tells Insta-Newsletter, the list of record (src/lib/server/insta-newsletter.ts). */
async function unsubscribe(formData: FormData) {
  "use server";
  const email = String(formData.get("e") || "").trim().toLowerCase(); if (!email) return;
  const { unsubscribeEmailEverywhere } = await import("@/lib/server/insta-newsletter");
  await unsubscribeEmailEverywhere(email);
  const { redirect } = await import("next/navigation"); redirect(`/unsubscribe?done=1&e=${encodeURIComponent(email)}`);
}
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; done?: string }> }) {
  const sp = await searchParams;
  return (
    <SiteFrame label="Email preferences" active="none" sourceKey="general">
      <section className="gx" style={{ paddingTop: 88, paddingBottom: 104, maxWidth: 640 }}>
        <span className="eyebrow">Email preferences</span>
        {sp.done ? (<><h1 className="h1" style={{ margin: "14px 0 18px" }}>You're unsubscribed.</h1><p className="lede">{sp.e} won't receive our newsletters anymore. Booking confirmations and project updates you've asked for still arrive.</p></>) : (<>
          <h1 className="h1" style={{ margin: "14px 0 18px" }}>Unsubscribe from our newsletters?</h1>
          <p className="lede">This removes <strong>{sp.e || "your address"}</strong> from the Caribbean Connection newsletter and the Healthy Home list.</p>
          <form action={unsubscribe} style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}><input type="hidden" name="e" value={sp.e || ""} />{!sp.e && <input name="e" type="email" required placeholder="you@example.com" className="input" style={{ minWidth: 260 }} />}<button type="submit" className="btn btn-navy">Unsubscribe</button></form>
        </>)}
      </section>
    </SiteFrame>
  );
}
