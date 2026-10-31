"use client";
import { useState } from "react";
import { saveBlock } from "@/lib/actions/content";
import ImagePicker from "./ImagePicker";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
const isImageKey = (k: string) => /img|photo|image|logo|avatar|thumb|poster/i.test(k);
const isImageVal = (v: unknown) => typeof v === "string" && (/^media:\/\//.test(v) || /^\/api\/media\//.test(v) || /^\/(media|assets)\//.test(v) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v));
const isLong = (k: string, v: string) => v.length > 80 || /\n|<p>|<br/.test(v) || /^(body|text|intro|sub|blurb|description|quote|summary|note|html|line)$/i.test(k);
const human = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const setAt = (obj: Json, path: (string | number)[], value: Json): Json => {
  if (!path.length) return value;
  const [h, ...rest] = path;
  if (Array.isArray(obj)) { const n = [...obj]; n[h as number] = setAt(n[h as number] ?? null, rest, value); return n; }
  const o = { ...((obj as Record<string, Json>) || {}) }; o[h as string] = setAt(o[h as string] ?? null, rest, value); return o;
};
const blank = (v: Json): Json => (typeof v === "string" ? "" : typeof v === "number" ? 0 : typeof v === "boolean" ? false : Array.isArray(v) ? v.map(blank) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x)])) : null);

/** Generic editor for a block's JSON content: strings, numbers, booleans, string lists, tuple rows, object lists and nested objects. */
export default function BlockEditor({ blockId, type, content, back, onClose }: { blockId: number; type: string; content: Record<string, Json>; back: string; onClose?: () => void }) {
  const [state, setState] = useState<Json>(content);
  const update = (path: (string | number)[], value: Json) => setState((s) => setAt(s, path, value));
  return (
    <form action={saveBlock} encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 12, background: "#f7f9fc", border: "1px solid #e3e6ec" }}>
      <input type="hidden" name="blockId" value={blockId} /><input type="hidden" name="_back" value={back} /><input type="hidden" name="content" value={JSON.stringify(state)} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontWeight: 700 }}>Edit {human(type)} block</span><span style={{ fontSize: 11, color: "#8c95a8" }}>Saved as a draft until you publish the page</span></div>
      <Fields value={state as Record<string, Json>} path={[]} update={update} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>{onClose && <button type="button" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }} onClick={onClose}>Cancel</button>}<button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>Save draft</button></div>
    </form>
  );
}

function Fields({ value, path, update }: { value: Record<string, Json>; path: (string | number)[]; update: (p: (string | number)[], v: Json) => void }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{Object.entries(value || {}).map(([k, v]) => <Field key={k} k={k} v={v} path={[...path, k]} update={update} />)}</div>;
}

function Field({ k, v, path, update }: { k: string; v: Json; path: (string | number)[]; update: (p: (string | number)[], v: Json) => void }) {
  const label = human(String(k)); const name = path.join(".");
  const full: React.CSSProperties = { gridColumn: "1/-1" };
  if (typeof v === "boolean") return <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, height: 40 }}><input type="checkbox" checked={v} onChange={(e) => update(path, e.target.checked)} />{label}</label>;
  if (typeof v === "number") return <label className="label label-caps">{label}<input type="number" value={v} onChange={(e) => update(path, Number(e.target.value))} className="admin-input admin-input-sm" /></label>;
  if (v === null || typeof v === "string") {
    const s = v ?? "";
    if (isImageKey(String(k)) || isImageVal(s)) return (
      <div style={{ ...full, padding: 8, borderRadius: 10, background: "#fff", border: "1px solid #eef0f4" }}>
        <ImagePicker label={label} fileName={`file::${name}`} value={s} onChange={(next) => update(path, next)} showUrl width={96} height={64} />
      </div>);
    if (isLong(String(k), s)) return <label className="label label-caps" style={full}>{label}<textarea value={s} rows={Math.min(10, Math.max(2, Math.ceil(s.length / 90)))} onChange={(e) => update(path, e.target.value)} className="admin-input" /></label>;
    return <label className="label label-caps">{label}<input value={s} onChange={(e) => update(path, e.target.value)} className="admin-input admin-input-sm" /></label>;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string")) {
      if (isImageKey(String(k))) return <div style={full}><span className="label-caps">{label}</span><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>{v.map((x, i) => <Field key={i} k={`${k} ${i + 1}`} v={x} path={[...path, i]} update={update} />)}</div></div>;
      return <label className="label label-caps" style={full}>{label} (one per line)<textarea value={(v as string[]).join("\n")} rows={Math.min(8, v.length + 1)} onChange={(e) => update(path, e.target.value.split("\n"))} className="admin-input" /></label>;
    }
    if (v.length && v.every((x) => Array.isArray(x) && x.every((y) => typeof y === "string"))) {
      const rows = v as string[][]; const cols = Math.max(...rows.map((r) => r.length));
      return (
        <div style={{ ...full, display: "flex", flexDirection: "column", gap: 6 }}><span className="label-caps">{label}</span>
          {rows.map((r, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr) auto`, gap: 6 }}>{Array.from({ length: cols }, (_, c) => <input key={c} value={r[c] ?? ""} onChange={(e) => update([...path, i, c], e.target.value)} className="admin-input admin-input-sm" />)}<button type="button" className="link-btn link-danger" onClick={() => update(path, rows.filter((_, j) => j !== i))}>×</button></div>)}
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => update(path, [...rows, Array(cols).fill("")])}>+ Add row</button>
        </div>);
    }
    if (v.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      const items = v as Record<string, Json>[];
      return (
        <div style={{ ...full, display: "flex", flexDirection: "column", gap: 8 }}><span className="label-caps">{label} ({items.length})</span>
          {items.map((it, i) => <div key={i} style={{ padding: 10, borderRadius: 10, border: "1px solid #e3e6ec", background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8c95a8" }}><span>{label} {i + 1}</span><span style={{ display: "flex", gap: 10 }}>{i > 0 && <button type="button" className="link-btn link-muted" onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; update(path, n); }}>↑</button>}{i < items.length - 1 && <button type="button" className="link-btn link-muted" onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; update(path, n); }}>↓</button>}<button type="button" className="link-btn link-danger" onClick={() => update(path, items.filter((_, j) => j !== i))}>Remove</button></span></div><Fields value={it} path={[...path, i]} update={update} /></div>)}
          <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => update(path, [...items, blank(items[items.length - 1]) as Record<string, Json>])}>+ Add {label.toLowerCase().replace(/s$/, "")}</button>
        </div>);
    }
    return <label className="label label-caps" style={full}>{label} (JSON)<textarea defaultValue={JSON.stringify(v, null, 2)} rows={4} onChange={(e) => { try { update(path, JSON.parse(e.target.value)); } catch { /* keep typing */ } }} className="admin-input" style={{ fontFamily: "monospace", fontSize: 12 }} /></label>;
  }
  if (v && typeof v === "object") return <div style={{ ...full, padding: 10, borderRadius: 10, border: "1px solid #e3e6ec", background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}><span className="label-caps">{label}</span><Fields value={v as Record<string, Json>} path={path} update={update} /></div>;
  return null;
}
