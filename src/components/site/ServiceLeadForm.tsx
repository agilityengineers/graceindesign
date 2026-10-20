"use client";
import { useState } from "react";
import Link from "next/link";
import { Check } from "@/components/ui/Icons";

type Extra = { key: string; label: string; type: string; options: string[]; placeholder: string | null; required: boolean };
const inp: React.CSSProperties = { height: 46, padding: "0 14px", border: "1px solid #dfe3ea", borderRadius: 10, fontSize: 14, color: "#1a2238", width: "100%", background: "#fff" };

export default function ServiceLeadForm({ slug, title, cta, pathId, extras }: { slug: string; title: string; cta: string; pathId: string | null; extras: Extra[] }) {
  const [a, setA] = useState<Record<string, string | string[]>>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const set = (k: string, v: string | string[]) => setA((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!consent) { setErr("Please confirm you agree to be contacted about your request."); return; }
    setBusy(true);
    try {
      const utm: Record<string, string> = {}; try { const sp = new URLSearchParams(window.location.search); ["utm_source", "utm_medium", "utm_campaign"].forEach((k) => { const v = sp.get(k); if (v) utm[k] = v; }); } catch {}
      const res = await fetch("/api/consult/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourcePage: slug, pathId, answers: { ...a, service: title, consent: !!consent, contact_pref: "Email" }, utm, website: a.__hp || "" }) });
      const j = await res.json();
      if (!res.ok || !j.ok) { setErr(j.error || "Please check the form and try again."); return; }
      setSent(true);
    } catch { setErr("Network error — please try again."); } finally { setBusy(false); }
  };
  if (sent) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#fff", padding: "64px 32px", borderRadius: 18, textAlign: "center", boxShadow: "0 18px 44px rgba(26,34,56,.08)" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={30} /></div>
      <h3 className="display" style={{ fontSize: 34, fontWeight: 500 }}>Thank you — we've got it.</h3>
      <p style={{ maxWidth: 380, fontSize: 15, lineHeight: 1.65, color: "#6b7486" }}>We've received your <strong>{title}</strong> request. Expect a reply from Grace within one business day.</p>
      <Link href={`/contact?from=${slug}`} style={{ fontSize: 13, fontWeight: 600, color: "#3f9ad9" }}>Want to pick a time now? Book a 15-minute call →</Link>
    </div>
  );
  return (
    <form onSubmit={submit} className="g2 g2-stack-sm form-card" style={{ gap: 16, background: "#fff", padding: 32, borderRadius: 18, boxShadow: "0 18px 44px rgba(26,34,56,.08)" }}>
      <label className="label">Full name<input required placeholder="Jane Doe" style={inp} value={(a.name as string) || ""} onChange={(e) => set("name", e.target.value)} /></label>
      <label className="label">Email<input required type="email" placeholder="jane@email.com" style={inp} value={(a.email as string) || ""} onChange={(e) => set("email", e.target.value)} /></label>
      <label className="label">Phone<input type="tel" placeholder="(555) 555-5555" style={inp} value={(a.phone as string) || ""} onChange={(e) => set("phone", e.target.value)} /></label>
      <label className="label">Service of interest<input readOnly value={title} style={{ ...inp, background: "#f7f8fa" }} /></label>
      <label className="label">Timeline<select style={inp} value={(a.timeline as string) || ""} onChange={(e) => set("timeline", e.target.value)}><option value="">Select…</option>{["As soon as possible", "1–3 months", "3–6 months", "Just exploring"].map((o) => <option key={o}>{o}</option>)}</select></label>
      <label className="label">Budget range<select style={inp} value={(a.budget as string) || ""} onChange={(e) => set("budget", e.target.value)}><option value="">Select…</option>{["Not sure yet", "Under $10k", "$10k–$50k", "$50k–$150k", "$150k+"].map((o) => <option key={o}>{o}</option>)}</select></label>
      {extras.map((q) => (
        <label key={q.key} className="label" style={{ gridColumn: ["textarea", "multiselect"].includes(q.type) ? "1/-1" : "auto" }}><span><span className="extra-dot">● </span>{q.label}{q.required && <span className="req"> *</span>}</span>
          {q.type === "select" || q.type === "multiselect" ? <select style={inp} required={q.required} value={(a[q.key] as string) || ""} onChange={(e) => set(q.key, e.target.value)}><option value="">Select…</option>{q.options.map((o) => <option key={o}>{o}</option>)}</select>
            : q.type === "date" ? <input type="date" style={inp} value={(a[q.key] as string) || ""} onChange={(e) => set(q.key, e.target.value)} />
            : <input placeholder={q.placeholder || ""} required={q.required} style={inp} value={(a[q.key] as string) || ""} onChange={(e) => set(q.key, e.target.value)} />}
        </label>
      ))}
      <label className="label" style={{ gridColumn: "1/-1" }}>Tell us about your space<textarea rows={4} placeholder="What's working, what isn't, and what you're hoping for…" style={{ ...inp, height: "auto", padding: "12px 14px", resize: "vertical" }} value={(a.notes as string) || ""} onChange={(e) => set("notes", e.target.value)} /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} value={(a.__hp as string) || ""} onChange={(e) => set("__hp", e.target.value)} />
      {err && <div role="alert" style={{ gridColumn: "1/-1", padding: "10px 14px", borderRadius: 10, background: "#fbe9e2", color: "#9a3c1e", fontSize: 13 }}>{err}</div>}
      <label style={{ gridColumn: "1/-1", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, color: "#4b5569", cursor: "pointer" }}><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} /><span>I agree to be contacted by email or text about my request.<span className="req"> *</span></span></label>
      <button type="submit" disabled={busy} className="btn btn-navy" style={{ gridColumn: "1/-1", height: 54, fontSize: 15, fontWeight: 700 }}>{busy ? "Sending…" : cta}</button>
      <span style={{ gridColumn: "1/-1", fontSize: 12, color: "#8c95a8", textAlign: "center" }}>We never share your details. See our <Link href="/privacy" style={{ color: "#3f9ad9" }}>privacy policy</Link>.</span>
    </form>
  );
}
