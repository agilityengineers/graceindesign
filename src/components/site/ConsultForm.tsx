"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Upload } from "@/components/ui/Icons";

type Field = { id: number; key: string; label: string; type: string; options: string[]; required: boolean; step: string; placeholder: string | null };
type Schema = { sourcePage: string; sourceLabel: string; inferredPath: string | null; mode: "wizard" | "single"; allowToggle: boolean; steps: { id: string; label: string }[]; paths: { id: string; label: string; short: string; consult: string; color: string }[]; baseFields: Field[]; pathFields: Record<string, Field[]>; booking: { durationMin: number; tz: string } };
type Slots = { days: { ymd: string; label: string; times: { hm: string; label: string; iso: string; taken: boolean }[] }[]; durationMin: number; tz: string };
type Answers = Record<string, string | string[] | boolean>;

const inputStyle: React.CSSProperties = { height: 44, padding: "0 12px", border: "1px solid #dfe3ea", borderRadius: 10, fontSize: 14, background: "#fff", width: "100%" };

export default function ConsultForm({ sourcePage, inModal, onBooked }: { sourcePage: string; inModal?: boolean; onBooked?: (id: number) => void }) {
  const [S, setS] = useState<Schema | null>(null);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [mode, setMode] = useState<"wizard" | "single">("wizard");
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<string | null>(null);
  const [inferred, setInferred] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<{ iso: string; label: string } | null>(null);
  const [sent, setSent] = useState<null | { leadId: number; bookingId: number | null; when: string | null }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/consult/schema?from=${encodeURIComponent(sourcePage)}`).then((r) => r.json()).then((s: Schema) => { setS(s); setMode(s.mode); setPath(s.inferredPath); setInferred(!!s.inferredPath); });
    fetch("/api/consult/slots").then((r) => r.json()).then((sl: Slots) => { setSlots(sl); setDay(sl.days[0]?.ymd ?? null); });
    try {
      const sp = new URLSearchParams(window.location.search); const u: Record<string, string> = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((k) => { const v = sp.get(k) || sessionStorage.getItem(`gid_${k}`); if (v) { u[k] = v; sessionStorage.setItem(`gid_${k}`, v); } });
      u.referrer = document.referrer || ""; u.landing = window.location.pathname;
      setUtm(u);
    } catch { /* ignore */ }
  }, [sourcePage]);

  const P = useMemo(() => S?.paths.find((p) => p.id === path) ?? null, [S, path]);
  if (!S) return <div style={{ padding: 60, textAlign: "center", color: "#6b7486", background: "#fff", borderRadius: 20, minHeight: 620 }}>Loading…</div>;
  const single = mode === "single";
  const stepIds = S.steps.map((s) => s.id);
  const cur = single ? "all" : stepIds[step];
  const show = (id: string) => !sent && (single || cur === id);
  const consultType = (P?.consult || "15-min discovery call").replace(/^15-min /, "15-minute ");
  const projectFields = [...(path ? S.pathFields[path] || [] : []).map((f) => ({ ...f, extra: true })), ...S.baseFields.filter((f) => f.step === "project").map((f) => ({ ...f, extra: false }))];
  const contactFields = S.baseFields.filter((f) => f.step === "contact");
  const reviewFields = S.baseFields.filter((f) => f.step === "review");
  const titles: Record<string, [string, string]> = { path: ["Tell us a little about you", "We tailor the next few questions to your situation."], project: ["Your project", `${P ? P.short : ""} details — fields marked ● are specific to this path.`], contact: ["How should we reach you?", "We reply within one business day."], schedule: [`Pick a time for your ${consultType}`, "Free, no obligation."], review: ["Confirm and book", "One last look before we save your request."], all: ["Schedule a consultation", "All questions on one page."] };
  const pickedWhen = time ? `${time.label} ET` : "No time selected yet";
  const last = step === stepIds.length - 1;
  const set = (k: string, v: string | string[] | boolean) => setAnswers((a) => ({ ...a, [k]: v }));

  const validate = (ids: string[]) => {
    for (const id of ids) {
      if (id === "path" && !path) return "Please choose the option that best describes you.";
      const fields = id === "project" ? projectFields : id === "contact" ? contactFields : id === "review" ? reviewFields : [];
      for (const f of fields) { const v = answers[f.key]; if (f.required && (v == null || v === "" || v === false || (Array.isArray(v) && !v.length))) return `Please complete “${f.label}”.`; if (f.type === "email" && typeof v === "string" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Please enter a valid email address."; }
    }
    return null;
  };

  const next = async () => {
    setError(null);
    if (single || last) {
      const err = validate(stepIds); if (err) { setError(err); return; }
      setBusy(true);
      try {
        const res = await fetch("/api/consult/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourcePage, pathId: path, answers, slotIso: time?.iso ?? null, utm, website: (answers as any).__hp || "" }) });
        const j = await res.json();
        if (!res.ok || !j.ok) { setError(j.error || "Something went wrong. Please try again or call (770) 691-1600."); return; }
        setSent({ leadId: j.leadId, bookingId: j.bookingId, when: j.when }); onBooked?.(j.leadId);
      } catch { setError("Network error — please try again."); } finally { setBusy(false); }
    } else { const err = validate([cur]); if (err) { setError(err); return; } setStep(step + 1); }
  };

  const renderField = (f: Field & { extra?: boolean }, span: boolean) => {
    const v = answers[f.key];
    const label = <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{f.extra && <span className="extra-dot">●</span>}{f.label}{f.required && <span className="req">*</span>}</span>;
    const wrapStyle: React.CSSProperties = { gridColumn: span || ["textarea", "upload", "address", "multiselect"].includes(f.type) ? "1/-1" : "auto" };
    switch (f.type) {
      case "select": return <label key={f.key} className="label" style={wrapStyle}>{label}<select style={inputStyle} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)} required={f.required}><option value="">Select…</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select></label>;
      case "multiselect": { const arr = Array.isArray(v) ? v : []; return <div key={f.key} className="label" style={wrapStyle}>{label}<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{f.options.map((o) => { const on = arr.includes(o); return <button type="button" key={o} onClick={() => set(f.key, on ? arr.filter((x) => x !== o) : [...arr, o])} className="pill" style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 500, ...(on ? { background: "#1a2238", color: "#fff", borderColor: "#1a2238" } : {}) }} aria-pressed={on}>{o}</button>; })}</div></div>; }
      case "textarea": return <label key={f.key} className="label" style={wrapStyle}>{label}<textarea rows={3} placeholder={f.placeholder || "What's working, what isn't, and what you're hoping for…"} style={{ ...inputStyle, height: "auto", padding: 12, resize: "vertical" }} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)} /></label>;
      case "date": return <label key={f.key} className="label" style={wrapStyle}>{label}<input type="date" style={inputStyle} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)} /></label>;
      case "address": return <label key={f.key} className="label" style={wrapStyle}>{label}<input placeholder="Street, City, State ZIP" style={inputStyle} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)} /></label>;
      case "upload": return <div key={f.key} className="label" style={wrapStyle}>{label}<label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 72, border: "1.5px dashed #c6cbd6", borderRadius: 10, fontSize: 13, color: "#6b7486", fontWeight: 500, cursor: "pointer" }}><Upload />{Array.isArray(v) && v.length ? `${v.length} photo${v.length > 1 ? "s" : ""} added` : "Drag photos here or click to upload (up to 10)"}<input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async (e) => { const files = Array.from(e.target.files || []).slice(0, 10); const urls: string[] = []; for (const file of files) { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/consult/upload", { method: "POST", body: fd }); const j = await r.json(); if (j.url) urls.push(j.url); } set(f.key, urls); }} /></label></div>;
      case "consent": return <label key={f.key} className="label" style={{ ...wrapStyle, flexDirection: "row", alignItems: "flex-start", gap: 10, fontWeight: 500, fontSize: 13, lineHeight: 1.5 }}><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} style={{ marginTop: 3 }} required={f.required} />{f.label}<span className="req">*</span></label>;
      case "yesno": return <label key={f.key} className="label" style={wrapStyle}>{label}<select style={inputStyle} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)}><option value="">Select…</option><option>Yes</option><option>No</option></select></label>;
      default: return <label key={f.key} className="label" style={wrapStyle}>{label}<input type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} placeholder={f.placeholder || (f.type === "email" ? "jane@email.com" : f.type === "phone" ? "(555) 555-5555" : "")} style={inputStyle} value={(v as string) || ""} onChange={(e) => set(f.key, e.target.value)} required={f.required} /></label>;
    }
  };

  const dayObj = slots?.days.find((d) => d.ymd === day);
  return (
    <div className="consult-form" style={{ fontFamily: "inherit", color: "#1a2238", background: "#fff", borderRadius: 20, boxShadow: inModal ? "0 24px 60px rgba(26,34,56,.14)" : "0 24px 60px rgba(26,34,56,.10)", overflow: "hidden", display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", minHeight: 620 }}>
      <aside className="consult-rail" style={{ background: "#1a2238", color: "#fff", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="eyebrow eyebrow-sm eyebrow-sky">Schedule a consultation</span>
          <span className="display" style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.15 }}>{consultType}</span>
          <span style={{ fontSize: 13, color: "#c6cbd6", lineHeight: 1.6 }}>Free · No obligation · We reply within one business day</span>
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {S.steps.map((s, k) => { const done = k < step || single || !!sent; const on = k === step && !single && !sent; return <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: on ? "rgba(255,255,255,.1)" : "transparent" }}><span style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? "#6cb6e6" : on ? "#fff" : "rgba(255,255,255,.12)", color: on || done ? "#1a2238" : "#c6cbd6" }}>{k + 1}</span><span style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, color: k <= step || single ? "#fff" : "#8c95a8" }}>{s.label}</span></li>; })}
        </ol>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, padding: 14, borderRadius: 12, background: "rgba(255,255,255,.06)", fontSize: 12, color: "#c6cbd6", lineHeight: 1.5 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6cb6e6" }} />What happens next</span>
          <span>We review your answers and reply within one business day. If you pick a time, Grace calls you then.</span>
        </div>
      </aside>
      <div style={{ padding: "36px 40px", display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }} className="consult-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><h2 className="display" style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.1 }}>{sent ? (sent.bookingId ? "You're booked." : "Thank you — we've got it.") : titles[cur][0]}</h2>{!sent && <span style={{ fontSize: 13, color: "#6b7486" }}>{titles[cur][1]}</span>}</div>
          {S.allowToggle && !sent && (
            <div className="seg seg-pill" role="tablist" aria-label="Form mode">
              <button type="button" role="tab" aria-selected={!single} className={!single ? "is-on" : ""} onClick={() => setMode("wizard")}>Steps</button>
              <button type="button" role="tab" aria-selected={single} className={single ? "is-on" : ""} onClick={() => setMode("single")}>One page</button>
            </div>
          )}
        </div>

        {show("path") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {inferred && P && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "#e6f3fc", fontSize: 13 }}><Check size={16} />Based on the page you came from, we've selected <strong style={{ marginLeft: 4 }}>{P.label}</strong>. Change it if that's not right.</div>}
            <div className="g2 g2-stack-sm" style={{ gap: 12 }}>
              {S.paths.map((p) => <button type="button" key={p.id} onClick={() => { setPath(p.id); setInferred(false); }} aria-pressed={p.id === path} style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, border: `1.5px solid ${p.id === path ? "#1a2238" : "#e3e6ec"}`, background: p.id === path ? "#f2f8fd" : "#fff", color: "#1a2238", cursor: "pointer", textAlign: "left", font: "inherit" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flex: "none" }} /><span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{p.label}</span></button>)}
            </div>
          </div>
        )}
        {show("project") && <div className="g2 g2-stack-sm" style={{ gap: 14 }}>{projectFields.map((f) => renderField(f, false))}</div>}
        {show("contact") && <div className="g2 g2-stack-sm" style={{ gap: 14 }}>{contactFields.map((f) => renderField(f, false))}</div>}
        {show("schedule") && (
          <div className="consult-schedule" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!slots ? <span style={{ color: "#6b7486", fontSize: 13 }}>Loading availability…</span> : !slots.days.length ? <span style={{ color: "#6b7486", fontSize: 13 }}>No open times in the next few weeks — we'll reach out to schedule.</span> : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{slots.days.map((d) => <button type="button" key={d.ymd} onClick={() => { setDay(d.ymd); setTime(null); }} style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${d.ymd === day ? "#1a2238" : "#e3e6ec"}`, background: d.ymd === day ? "#1a2238" : "#fff", color: d.ymd === day ? "#fff" : "#1a2238", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{d.label}</button>)}</div>
                  <div className="g4" style={{ gap: 8 }}>{dayObj?.times.map((tm) => <button type="button" key={tm.iso} disabled={tm.taken} onClick={() => setTime({ iso: tm.iso, label: `${dayObj.label} · ${tm.label}` })} style={{ padding: "12px 0", textAlign: "center", borderRadius: 10, border: `1.5px solid ${time?.iso === tm.iso ? "#1a2238" : "#e3e6ec"}`, background: tm.taken ? "#f2f4f7" : time?.iso === tm.iso ? "#e6f3fc" : "#fff", color: tm.taken ? "#c6cbd6" : "#1a2238", fontSize: 13, fontWeight: 600, textDecoration: tm.taken ? "line-through" : "none", cursor: tm.taken ? "not-allowed" : "pointer" }}>{tm.label}</button>)}</div>
                </>
              )}
              <span style={{ fontSize: 12, color: "#8c95a8" }}>Times shown in Eastern Time.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18, borderRadius: 14, background: "#f7f8fa", border: "1px solid #e9ecf1" }}>
              <span className="eyebrow eyebrow-sm" style={{ letterSpacing: ".14em" }}>Your appointment</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{consultType}</span>
              <span style={{ fontSize: 13, color: "#4b5569" }}>{pickedWhen}</span>
              <span style={{ fontSize: 12, color: "#6b7486", lineHeight: 1.5 }}>With Grace A. Williams · Phone or video</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, fontSize: 12, color: "#6b7486" }}>
                {["Email + SMS confirmation", "Calendar invite (.ics)", "Pre-consult checklist PDF"].map((x) => <span key={x} style={{ display: "flex", gap: 8, alignItems: "center" }}><Check size={12} />{x}</span>)}
              </div>
            </div>
          </div>
        )}
        {show("review") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="g3" style={{ gap: 12 }}>
              {[["I am", P ? P.label : "Not selected"], ["Appointment", pickedWhen], ["Consultation", consultType]].map(([k, v]) => <div key={k} style={{ padding: 16, borderRadius: 12, background: "#f7f8fa", display: "flex", flexDirection: "column", gap: 4 }}><span className="label-caps" style={{ letterSpacing: ".12em" }}>{k}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span></div>)}
            </div>
            {reviewFields.map((f) => <div key={f.key} style={{ maxWidth: f.type === "select" ? 360 : undefined }}>{renderField(f, true)}</div>)}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0 }} value={(answers as any).__hp || ""} onChange={(e) => set("__hp", e.target.value)} />
          </div>
        )}
        {sent && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: "40px 20px", flex: 1 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e6f3fc", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={30} /></div>
            <h3 className="display" style={{ fontSize: 34, fontWeight: 500 }}>{sent.bookingId ? "You're booked." : "Thank you — we've got it."}</h3>
            <p style={{ maxWidth: 440, fontSize: 15, lineHeight: 1.65, color: "#6b7486" }}>
              {sent.bookingId ? <>{consultType} · {sent.when}. A confirmation and calendar invite are on their way. <Link href={`/booking/${sent.bookingId}?e=${encodeURIComponent(String(answers.email || ""))}`} style={{ color: "#3f9ad9", fontWeight: 600 }}>View booking details</Link>.</> : <>We've received your request. Expect a reply from Grace within one business day.</>}
            </p>
          </div>
        )}
        {error && <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: "#fbe9e2", color: "#9a3c1e", fontSize: 13 }}>{error}</div>}
        {!sent && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8, borderTop: "1px solid #eef0f4", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0 || single} style={{ fontSize: 13, fontWeight: 600, color: step > 0 && !single ? "#1a2238" : "#c6cbd6", background: "none", border: 0, cursor: step > 0 && !single ? "pointer" : "default", font: "inherit" }}>← Back</button>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 12, color: "#8c95a8" }}>{single ? "" : `Step ${step + 1} of ${stepIds.length}`}</span>
              <button type="button" className="btn btn-navy" onClick={next} disabled={busy}>{busy ? "Saving…" : single || last ? "Book my consultation" : "Continue"} <ArrowRight size={14} color="currentColor" /></button>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @media (max-width: 900px) { .consult-form { grid-template-columns: 1fr !important; } .consult-rail { padding: 24px 20px !important; } .consult-body { padding: 24px 20px !important; } .consult-schedule { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
