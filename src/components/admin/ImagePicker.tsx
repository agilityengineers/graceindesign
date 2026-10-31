"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type LibraryItem = { id: number; name: string; slot: string | null; alt: string | null; source: string; preview: string; ref: string };

// One shared fetch of the full library per page load: powers media:// previews and the picker's first paint.
let allItems: Promise<LibraryItem[]> | null = null;
function fetchLibrary(q = ""): Promise<LibraryItem[]> {
  return fetch(`/api/admin/media${q ? `?q=${encodeURIComponent(q)}` : ""}`, { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((j: { items?: LibraryItem[] }) => j.items || [])
    .catch(() => []);
}
function loadAll(refresh = false) { if (!allItems || refresh) allItems = fetchLibrary(); return allItems; }

const placeholder = (ref: string) => `/api/placeholder?label=${encodeURIComponent(ref.startsWith("media://") ? ref.slice(8) : "image")}`;

/**
 * Image field for admin forms: upload from the computer *or* choose from the media library.
 * Submits `name` (the chosen URL / media://slot) and `fileName` (an uploaded file, which the server action prefers when present).
 * Works uncontrolled (`defaultValue`) or controlled (`value` + `onChange`).
 */
export default function ImagePicker({ name, fileName, value, defaultValue = "", onChange, preview, label, showUrl = false, width = 120, height = 80, layout = "row", objectPosition }: {
  name?: string; fileName: string; value?: string; defaultValue?: string; onChange?: (ref: string) => void; preview?: string; label?: string;
  showUrl?: boolean; width?: number | string; height?: number; layout?: "row" | "stack"; objectPosition?: string;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const ref = controlled ? value : inner;
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = useRef(ref); // `preview` describes the initial value only

  const setRef = (next: string) => { if (!controlled) setInner(next); onChange?.(next); };
  const clearFile = () => { if (fileRef.current) fileRef.current.value = ""; if (filePreview) URL.revokeObjectURL(filePreview); setFilePreview(null); setFileLabel(null); };

  // Resolve a media://slot reference to its current library image for the preview.
  const needsLookup = !!ref && ref.startsWith("media://") && !pickedPreview && !(preview && ref === initial.current);
  useEffect(() => {
    if (!needsLookup) return;
    let live = true;
    loadAll().then((items) => { if (live) setResolved(items.find((i) => i.ref === ref)?.preview || null); });
    return () => { live = false; };
  }, [needsLookup, ref]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  const shown = filePreview || pickedPreview || (needsLookup ? resolved : null) || (ref && ref === initial.current ? preview : null) || (ref ? (ref.startsWith("media://") ? placeholder(ref) : ref) : null);

  const pick = (item: LibraryItem) => { clearFile(); setPickedPreview(item.preview); setRef(item.ref); setOpen(false); };
  const onFile = (f: File | undefined) => { if (filePreview) URL.revokeObjectURL(filePreview); if (!f) { setFilePreview(null); setFileLabel(null); return; } setFilePreview(URL.createObjectURL(f)); setFileLabel(f.name); };

  const thumb = (
    <div style={{ width, height, borderRadius: 8, overflow: "hidden", background: "#f2f4f7", flex: "none", position: "relative" }}>
      {shown ? <img src={shown} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition }} /> : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#8c95a8" }}>No image</span>}
    </div>
  );
  const controls = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      {label && <span className="label-caps">{label}</span>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }} onClick={() => fileRef.current?.click()}>Upload from computer</button>
        <button type="button" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }} onClick={() => setOpen(true)}>Choose from library</button>
      </div>
      <input ref={fileRef} type="file" name={fileName} accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {name && !showUrl && <input type="hidden" name={name} value={ref} />}
      {showUrl && <input name={name} value={ref} onChange={(e) => { setPickedPreview(null); setRef(e.target.value); }} className="admin-input admin-input-sm" placeholder="media://slot or https://…" aria-label={label ? `${label} URL` : "Image URL"} />}
      {fileLabel
        ? <span style={{ fontSize: 11, color: "#4b5569", display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>New upload: {fileLabel} · saved to the library when you save</span><button type="button" className="link-btn link-danger" onClick={clearFile}>Undo</button></span>
        : pickedPreview ? <span style={{ fontSize: 11, color: "#4b5569" }}>From library: {ref.startsWith("media://") ? ref.slice(8) : "image"} · applies when you save</span> : null}
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", flexDirection: layout === "stack" ? "column" : "row", gap: layout === "stack" ? 8 : 12, alignItems: layout === "stack" ? "stretch" : "center" }}>{thumb}{controls}</div>
      {open && <LibraryModal current={ref} onPick={pick} onClose={() => setOpen(false)} onUpload={() => { setOpen(false); fileRef.current?.click(); }} />}
    </>
  );
}

function LibraryModal({ current, onPick, onClose, onUpload }: { current: string; onPick: (i: LibraryItem) => void; onClose: () => void; onUpload: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { (q ? fetchLibrary(q) : loadAll(true)).then((r) => { if (live) setItems(r); }); }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const tile: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, padding: 6, borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", font: "inherit" };
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Choose from the media library">
      <div className="modal-panel" style={{ background: "#fff", width: 920, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 16, fontWeight: 600 }}>Media library</span><span style={{ fontSize: 12, color: "#6b7486" }}>Pick an image already in the library, or upload a new one from your computer.</span></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} placeholder="Search name, slot, subject" className="admin-input admin-input-sm" style={{ width: 220 }} aria-label="Search the library" />
            <button type="button" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }} onClick={onUpload}>Upload from computer</button>
            <button type="button" className="link-btn link-muted" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        {!items ? <div style={{ padding: 32, textAlign: "center", color: "#8c95a8", fontSize: 13 }}>Loading the library…</div>
          : !items.length ? <div style={{ padding: 32, textAlign: "center", color: "#8c95a8", fontSize: 13 }}>{q ? `Nothing matches “${q}”.` : "The library is empty — upload an image to get started."}</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, maxHeight: "62vh", overflow: "auto", padding: 2 }}>
              {items.map((it) => {
                const on = it.ref === current;
                return (
                  <button type="button" key={it.id} onClick={() => onPick(it)} title={it.alt || it.name} style={{ ...tile, border: on ? "2px solid #6cb6e6" : "1px solid #eef0f4" }}>
                    <div style={{ height: 100, borderRadius: 6, overflow: "hidden", background: "#f2f4f7" }}><img src={it.preview} alt={it.alt || it.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#1a2238", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.slot || it.name}</span>
                    <span style={{ fontSize: 10, color: "#8c95a8" }}>{on ? "Current image" : it.source}</span>
                  </button>);
              })}
            </div>}
      </div>
    </div>,
    document.body,
  );
}
