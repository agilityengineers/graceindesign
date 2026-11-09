import Link from "next/link";
import SiteFrame from "@/components/site/SiteFrame";
import { Check } from "@/components/ui/Icons";
import { walkthroughLeadMagnet } from "@/lib/server/walkthrough";
import { WALKTHROUGH_PDF_PATH } from "@/lib/walkthrough";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your checklist is ready", robots: { index: false, follow: false } };

/** The sidebar's "Or request a full home assessment →" as a button: no leading "Or", no arrow, capitalised. */
const buttonLabel = (s: string) => { const t = s.replace(/\s*→\s*$/, "").replace(/^or\s+/i, "").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

/**
 * Where "Send me the checklist" lands: the download button, and a reminder that the same link is in the email.
 * The wording comes from the Lead magnet settings in Admin → Content → WELLness Resources, so it stays in step with the sidebar.
 * Nothing personal travels in the URL, so this page can count as a plain conversion in analytics.
 */
export default async function ChecklistDownloadPage() {
  const lm = await walkthroughLeadMagnet();
  return (
    <SiteFrame label="WELLness Resources" active="hbd" sourceKey="wellness">
      <section className="gx" style={{ paddingTop: 88, paddingBottom: 104, maxWidth: 760 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}><Check size={30} /></div>
        <span className="eyebrow">{lm.eyebrow}</span>
        <h1 className="h1" style={{ margin: "14px 0 18px" }}>Your checklist is ready.</h1>
        <p className="lede">Here's <strong>{lm.title}</strong>. We've also emailed you the link, so you can come back to it anytime.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
          <a className="btn btn-navy" href={WALKTHROUGH_PDF_PATH} target="_blank" rel="noopener">Download the checklist (PDF)</a>
          {lm.linkHref && lm.link && <Link className="btn btn-ghost" href={lm.linkHref}>{buttonLabel(lm.link)}</Link>}
        </div>
        <p style={{ marginTop: 28, fontSize: 14, color: "#6b7486", lineHeight: 1.7 }}>Walk one room at a time, note what you find, and bring it to your consultation. Didn't get the email? Check your spam folder, or just use the button above.</p>
        <p style={{ marginTop: 12, fontSize: 14 }}><Link href="/healthy-home-resources/wellness#guides" style={{ color: "#3f9ad9", fontWeight: 600 }}>← Back to WELLness Resources</Link></p>
      </section>
    </SiteFrame>
  );
}
