import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { issueMagicLink } from "@/lib/auth/magic-link";
import { rateLimit } from "@/lib/server/rate-limit";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { ssoConfigured } from "@/lib/auth/cft-sso";
import { getDevLink, setDevLink } from "@/lib/auth/dev-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

async function sendLink(formData: FormData) {
  "use server";
  await setDevLink(null);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const next = String(formData.get("next") || "/admin");
  const h = await headers(); const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!(await rateLimit(`login:${ip}`, 10, 900)).ok) redirect(`/login?err=rate&next=${encodeURIComponent(next)}`);
  if (!email) redirect(`/login?err=email`);
  const res = await issueMagicLink(email, next.startsWith("/") ? next : "/admin");
  await setDevLink(res.devLink);
  redirect("/login?sent=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; err?: string }> }) {
  const sp = await searchParams;
  const u = await getCurrentUser(); if (u) redirect(sp.next || "/admin");
  const next = sp.next || "/admin";
  const devLink = sp.sent ? await getDevLink() : null;
  return (
    <div style={{ minHeight: "100vh", background: "#1a2238", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 440, maxWidth: "100%", background: "#fff", borderRadius: 20, padding: 40, display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 30px 80px rgba(0,0,0,.35)" }}>
        <img src="/assets/logo-dark-transparent.png" alt="Grace In Design" style={{ height: 44, width: "auto", alignSelf: "flex-start" }} />
        <span className="eyebrow">Site admin</span>
        <h1 className="display" style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.1 }}>Sign in with a magic link</h1>
        {sp.sent ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 12, background: "#e6f3fc", fontSize: 14, lineHeight: 1.6 }}>
            <strong>Check your email.</strong> If that address belongs to a team member, a sign-in link is on its way. It expires in 20 minutes.
            {devLink && <span style={{ fontSize: 12, color: "#6b7486" }}>Email isn't configured yet (no SENDGRID_API_KEY), so here's your link: <a href={devLink} referrerPolicy="no-referrer" style={{ color: "#3f9ad9", fontWeight: 600, wordBreak: "break-all" }}>open sign-in link</a></span>}
          </div>
        ) : (
          <form action={sendLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="hidden" name="next" value={next} />
            <label className="label">Work email<input name="email" type="email" required placeholder="you@graceindesign.net" className="input input-lg" autoFocus /></label>
            {sp.err === "rate" && <span style={{ color: "#9a3c1e", fontSize: 13 }}>Too many attempts — try again in a few minutes.</span>}
            {sp.err === "email" && <span style={{ color: "#9a3c1e", fontSize: 13 }}>Please enter your email.</span>}
            {sp.err === "invalid" && <span style={{ color: "#9a3c1e", fontSize: 13 }}>That link is invalid or expired. Request a new one.</span>}
            {sp.err === "sso" && <span style={{ color: "#9a3c1e", fontSize: 13 }}>Single sign-on from Call Flow Tracker was refused. Try again from CFT or sign in by email.</span>}
            <button type="submit" className="btn btn-navy" style={{ height: 50 }}>Email me a sign-in link</button>
            <span style={{ fontSize: 12, color: "#8c95a8", lineHeight: 1.6 }}>Invite-only. Owners add team members under Content → Site settings → Users &amp; roles.{ssoConfigured() && env.cft.url ? <> You can also open this app from <a href={env.cft.url} style={{ color: "#3f9ad9", fontWeight: 600 }}>Call Flow Tracker</a> → Connected Apps.</> : null}</span>
          </form>
        )}
        <Link href="/" style={{ fontSize: 13, color: "#6b7486" }}>← Back to the site</Link>
      </div>
    </div>
  );
}
