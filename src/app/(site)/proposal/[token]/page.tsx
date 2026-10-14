import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import SiteFrame from "@/components/site/SiteFrame";
import { db, proposals } from "@/lib/db";
import { signProposal } from "@/lib/server/esign";
import { money, fmtDateTime } from "@/lib/utils";
import { Check } from "@/components/ui/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your proposal", robots: { index: false, follow: false } };

async function sign(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || ""); const name = String(formData.get("name") || "").trim().slice(0, 120);
  if (!name || formData.get("agree") !== "on") redirect(`/proposal/${token}?err=1#sign`);
  const h = await headers(); const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await signProposal(token, name, ip, String(formData.get("signature") || "").slice(0, 200000) || undefined);
  redirect(`/proposal/${token}?signed=1`);
}

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ err?: string; signed?: string }> }) {
  const { token } = await params; const sp = await searchParams;
  const p = await db.query.proposals.findFirst({ where: eq(proposals.token, token) }); if (!p || p.status === "draft") notFound();
  if (!p.viewedAt) await db.update(proposals).set({ viewedAt: new Date(), status: p.status === "sent" ? "viewed" : p.status }).where(eq(proposals.id, p.id));
  const html = /<[a-z][\s\S]*>/i.test(p.body) ? p.body : p.body.split(/\n{2,}/).map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`).join("");
  return (
    <SiteFrame label="Proposal" active="none" sourceKey="general">
      <section className="gx" style={{ paddingTop: 72, paddingBottom: 104, maxWidth: 820, display: "flex", flexDirection: "column", gap: 28 }}>
        <div><span className="eyebrow">Proposal{p.recipientName ? ` for ${p.recipientName}` : ""}</span><h1 className="h1" style={{ fontSize: 48, marginTop: 14 }}>{p.title}</h1>{p.amount && <p className="lede" style={{ marginTop: 10 }}>Investment: <strong>{money(Number(p.amount))}</strong></p>}</div>
        <div className="prose" style={{ fontSize: 17, lineHeight: 1.75, color: "#4b5569" }} dangerouslySetInnerHTML={{ __html: html }} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><a className="btn btn-ghost" href={`/api/proposal/${token}/pdf`} target="_blank" rel="noreferrer">Download PDF</a></div>
        {p.status === "signed" || sp.signed ? (
          <div style={{ padding: 24, borderRadius: 16, background: "#dcefe4", display: "flex", gap: 14, alignItems: "flex-start" }}><span style={{ width: 36, height: 36, borderRadius: "50%", background: "#1f6b3f", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Check size={18} color="#fff" /></span><div style={{ fontSize: 15, lineHeight: 1.6, color: "#1f6b3f" }}><strong>Signed{p.signerName ? ` by ${p.signerName}` : ""}</strong>{p.signedAt ? ` on ${fmtDateTime(p.signedAt)} ET` : ""}.<br />Thank you — we'll be in touch with next steps. A copy of this page stays available at this link.</div></div>
        ) : p.status === "declined" ? (
          <div style={{ padding: 24, borderRadius: 16, background: "#f2f4f7", fontSize: 15 }}>This proposal is no longer active. Contact us at (770) 691-1600 if you'd like a revised version.</div>
        ) : (
          <form id="sign" action={sign} style={{ padding: 28, borderRadius: 20, border: "1px solid #e9ecf1", background: "#fff", display: "flex", flexDirection: "column", gap: 16 }}>
            <input type="hidden" name="token" value={token} />
            <h2 className="h2" style={{ fontSize: 26 }}>Accept and sign</h2>
            <p style={{ fontSize: 14, color: "#6b7486", lineHeight: 1.6 }}>Typing your full name below and clicking “Sign proposal” creates a legally binding electronic signature. We record your name, the time and your IP address with the signed copy.</p>
            <label className="label">Full legal name<input name="name" required className="input input-lg" placeholder="Your name" style={{ fontFamily: "var(--font-display)", fontSize: 24 }} /></label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5 }}><input type="checkbox" name="agree" required style={{ marginTop: 3 }} />I have read this proposal and agree to its scope, investment and terms.</label>
            {sp.err && <span style={{ color: "#9a3c1e", fontSize: 13 }}>Please enter your name and tick the agreement box.</span>}
            <button type="submit" className="btn btn-navy btn-lg" style={{ alignSelf: "flex-start" }}>Sign proposal</button>
          </form>
        )}
      </section>
    </SiteFrame>
  );
}
