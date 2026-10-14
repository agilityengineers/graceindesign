"use client";
import { useState } from "react";
import { Check } from "@/components/ui/Icons";

const inp: React.CSSProperties = { height: 44, padding: "0 12px", border: "1px solid #dfe3ea", borderRadius: 10, fontSize: 14, background: "#fff", width: "100%" };
async function post(url: string, body: Record<string, unknown>) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.ok === false) throw new Error(j.error || "Something went wrong"); return j; }
function useForm() { const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); return { sent, setSent, busy, setBusy, err, setErr }; }
const Done = ({ title, body }: { title: string; body: string }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", padding: "48px 28px", borderRadius: 16, border: "1px solid #e9ecf1", textAlign: "center", color: "#1a2238" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={26} /></div><span className="display" style={{ fontSize: 30, fontWeight: 500 }}>{title}</span><span style={{ fontSize: 14, color: "#6b7486", lineHeight: 1.6, maxWidth: 360 }}>{body}</span></div>
);

export function SuggestResourceForm() {
  const f = useForm(); const [who, setWho] = useState<"suggestion" | "own">("suggestion");
  if (f.sent) return <Done title="Thank you — it's in review." body="Your submission is now in the admin queue as Pending. We'll email you when it's published." />;
  return (
    <form className="g2 g2-stack-sm" style={{ gap: 12, background: "#fff", padding: 24, borderRadius: 16, border: "1px solid #e9ecf1" }} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); f.setBusy(true); f.setErr(null); try { await post("/api/caribbean/resource", { kind: who, ...Object.fromEntries(fd.entries()) }); f.setSent(true); } catch (x: any) { f.setErr(x.message); } finally { f.setBusy(false); } }}>
      <div className="label" style={{ gridColumn: "1/-1", flexDirection: "row", flexWrap: "wrap", gap: 8 }}><span style={{ width: "100%" }}>I am…</span>{([["suggestion", "Suggesting a resource I know"], ["own", "Listing my own organization"]] as const).map(([k, l]) => <button key={k} type="button" className={`pill${who === k ? " is-on" : ""}`} style={{ border: "1.5px solid", borderColor: who === k ? "#1a2238" : "#e3e6ec" }} onClick={() => setWho(k)}>{l}</button>)}</div>
      <label className="label" style={{ gridColumn: "1/-1" }}><span>Organization / resource name <span className="req">*</span></span><input name="name" required placeholder="e.g. St. Ann Senior Care Network" style={inp} /></label>
      <label className="label"><span>Category <span className="req">*</span></span><select name="category" required style={inp} defaultValue=""><option value="">Select…</option>{["Government", "Health", "Housing & home modification", "Community", "Diaspora", "Disaster readiness", "Financial support", "Care provider", "Contractor / installer"].map((o) => <option key={o}>{o}</option>)}</select></label>
      <label className="label"><span>Country &amp; parish / area <span className="req">*</span></span><input name="area" required placeholder="Jamaica · St. Catherine" style={inp} /></label>
      <label className="label">Website or phone<input name="url" placeholder="https:// or (876) …" style={inp} /></label>
      <label className="label"><span>Contact email <span className="req">*</span></span><input name="email" type="email" required placeholder="you@email.com" style={inp} /></label>
      <label className="label" style={{ gridColumn: "1/-1" }}><span>What do they offer older adults, families or caregivers? <span className="req">*</span></span><textarea name="description" required rows={3} placeholder="One or two sentences…" style={{ ...inp, height: "auto", padding: 12, resize: "vertical" }} /></label>
      <label className="label" style={{ gridColumn: "1/-1", flexDirection: "row", alignItems: "flex-start", gap: 10, fontWeight: 500, lineHeight: 1.5 }}><input type="checkbox" required style={{ marginTop: 3 }} />I confirm this information is accurate and may be published in the Caribbean Connection directory after review.</label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} />
      {f.err && <div role="alert" style={{ gridColumn: "1/-1", color: "#9a3c1e", fontSize: 13 }}>{f.err}</div>}
      <button type="submit" disabled={f.busy} className="btn btn-navy" style={{ gridColumn: "1/-1", fontWeight: 700 }}>{f.busy ? "Submitting…" : "Submit for review"}</button>
    </form>
  );
}

export function SubmitEventForm() {
  const f = useForm();
  if (f.sent) return <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e9ecf1" }}><div style={{ width: 40, height: 40, flex: "none", borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={18} /></div><div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>Thanks — your event is in review.</span><span style={{ fontSize: 13, color: "#6b7486" }}>It's now <strong>Pending</strong> in the admin queue. We'll email you when it's listed.</span></div></div>;
  return (
    <form className="g2 g2-stack-sm" style={{ gap: 12 }} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); f.setBusy(true); f.setErr(null); try { await post("/api/caribbean/event", Object.fromEntries(fd.entries())); f.setSent(true); } catch (x: any) { f.setErr(x.message); } finally { f.setBusy(false); } }}>
      <label className="label" style={{ gridColumn: "1/-1" }}><span>Event title <span className="req">*</span></span><input name="title" required placeholder="e.g. Fall-Prevention Workshop for Seniors" style={inp} /></label>
      <label className="label"><span>Date <span className="req">*</span></span><input name="date" type="date" required style={inp} /></label>
      <label className="label">Start time &amp; time zone<input name="time" placeholder="10:00 AM · Jamaica (EST)" style={inp} /></label>
      <label className="label"><span>Format <span className="req">*</span></span><select name="format" required style={inp} defaultValue=""><option value="">Select…</option><option value="in_person">In person</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option></select></label>
      <label className="label">Location (or link for virtual)<input name="where" placeholder="Kingston, Jamaica · venue" style={inp} /></label>
      <label className="label"><span>Host organization <span className="req">*</span></span><input name="host" required placeholder="Organization name" style={inp} /></label>
      <label className="label"><span>Contact email <span className="req">*</span></span><input name="email" type="email" required placeholder="you@email.com" style={inp} /></label>
      <label className="label" style={{ gridColumn: "1/-1" }}><span>Short description <span className="req">*</span></span><textarea name="description" required rows={2} placeholder="Who it's for and what to expect…" style={{ ...inp, height: "auto", padding: 12, resize: "vertical" }} /></label>
      <label className="label">Registration link<input name="url" placeholder="https://" style={inp} /></label>
      <label className="label">Cost<select name="cost" style={inp} defaultValue="Free"><option>Free</option><option>Paid</option><option>Donation</option></select></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} />
      {f.err && <div role="alert" style={{ gridColumn: "1/-1", color: "#9a3c1e", fontSize: 13 }}>{f.err}</div>}
      <button type="submit" disabled={f.busy} className="btn btn-navy" style={{ gridColumn: "1/-1", fontWeight: 700 }}>{f.busy ? "Submitting…" : "Submit event for review"}</button>
    </form>
  );
}

export function NewsletterForm() {
  const f = useForm();
  if (f.sent) return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", color: "#1a2238", padding: "48px 28px", borderRadius: 18, textAlign: "center" }}><div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={26} /></div><span className="display" style={{ fontSize: 30, fontWeight: 500 }}>You're on the list.</span><span style={{ fontSize: 14, color: "#6b7486", lineHeight: 1.6 }}>Watch for the next Caribbean Connection highlights.</span></div>;
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 12, background: "#fff", color: "#1a2238", padding: 28, borderRadius: 18 }} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); f.setBusy(true); f.setErr(null); try { await post("/api/caribbean/subscribe", Object.fromEntries(fd.entries())); f.setSent(true); } catch (x: any) { f.setErr(x.message); } finally { f.setBusy(false); } }}>
      <label className="label">Email<input name="email" type="email" required placeholder="you@email.com" style={{ ...inp, height: 46 }} /></label>
      <label className="label">I am…<select name="segment" style={{ ...inp, height: 46 }}>{["Living in Jamaica", "In the diaspora, supporting family back home", "A caregiver or care professional", "A community organization or agency"].map((o) => <option key={o}>{o}</option>)}</select></label>
      <label className="label">Where are you?<input name="location" placeholder="City, Country" style={{ ...inp, height: 46 }} /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} />
      {f.err && <div role="alert" style={{ color: "#9a3c1e", fontSize: 13 }}>{f.err}</div>}
      <button type="submit" disabled={f.busy} className="btn btn-navy" style={{ height: 50, fontWeight: 700, marginTop: 4 }}>{f.busy ? "Subscribing…" : "Subscribe"}</button>
      <span style={{ fontSize: 11, color: "#8c95a8", textAlign: "center", lineHeight: 1.5 }}>By subscribing you agree to receive the Caribbean Connection newsletter by email. Unsubscribe anytime.</span>
    </form>
  );
}

export function LeadMagnetForm({ cta }: { cta: string }) {
  const f = useForm();
  if (f.sent) return <span style={{ fontSize: 14, color: "#6cb6e6", fontWeight: 600 }}>Sent! Check your inbox for the checklist.</span>;
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); f.setBusy(true); f.setErr(null); try { await post("/api/newsletter/checklist", Object.fromEntries(fd.entries())); f.setSent(true); } catch (x: any) { f.setErr(x.message); } finally { f.setBusy(false); } }}>
      <input name="email" type="email" required placeholder="Your email" style={{ height: 46, padding: "0 14px", border: 0, borderRadius: 10, fontSize: 14 }} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} />
      {f.err && <span style={{ color: "#f5b7a3", fontSize: 12 }}>{f.err}</span>}
      <button type="submit" disabled={f.busy} className="btn btn-sky" style={{ boxShadow: "none" }}>{f.busy ? "Sending…" : cta}</button>
    </form>
  );
}

export default function CaribbeanForms({ kind }: { kind: string }) { return <div style={{ padding: 24, color: "#9a3c1e", fontSize: 13 }}>Unknown block type “{kind}”.</div>; }
