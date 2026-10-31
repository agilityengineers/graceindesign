"use client";
import { useState } from "react";
import { saveHero } from "@/lib/actions/hero";
import ImagePicker from "./ImagePicker";

export type HeroTarget = { kind: "page" | "service"; id: string; label: string; style: "classic" | "cinematic"; href: string; blockType: string; kicker: string; lead: string; tail: string; cta: string; scenesLabel: string; slideSeconds: number; scenes: { name: string; word: string; line?: string; img: string; href?: string }[]; sub: string; secondary: string; classicTitle: string; classicSub: string; classicImg: string; beforeAfter: { before: string; after: string; title: string } | null; supportsClassic: boolean; supportsCinematic: boolean };
type SceneState = { key: number; name: string; word: string; line: string; img: string; href: string; deleted: boolean };

export default function HeroEditor({ target: t }: { target: HeroTarget }) {
  const [style, setStyle] = useState<"classic" | "cinematic">(t.style);
  const [scenes, setScenes] = useState<SceneState[]>(t.scenes.map((s, i) => ({ key: i, name: s.name, word: s.word, line: s.line || "", img: s.img, href: s.href || "", deleted: false })));
  const [drag, setDrag] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(t.slideSeconds);
  const live = scenes.filter((s) => !s.deleted);
  const update = (key: number, patch: Partial<SceneState>) => setScenes((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (from: number, to: number) => setScenes((ss) => { const n = [...ss]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  const addScene = () => setScenes((ss) => [...ss, { key: Date.now(), name: `Scene ${live.length + 1}`, word: "", line: "", img: "", href: "", deleted: false }]);
  const cinematic = style === "cinematic";
  return (
    <form action={saveHero} encType="multipart/form-data" className="admin-card" style={{ gap: 18 }}>
      <input type="hidden" name="kind" value={t.kind} /><input type="hidden" name="id" value={t.id} /><input type="hidden" name="heroStyle" value={style} />
      <input type="hidden" name="sceneCount" value={scenes.length} /><input type="hidden" name="sceneOrder" value={scenes.map((_, i) => i).join(",")} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{t.label} — hero</span><span style={{ fontSize: 12, color: "#6b7486" }}>{cinematic ? "Rotating scenes with a highlighted word and progress rail" : "Single photo with headline, intro and stats"}</span></div>
        <div className="seg">
          <button type="button" className={!cinematic ? "is-on" : ""} onClick={() => t.supportsClassic && setStyle("classic")} disabled={!t.supportsClassic} title={t.supportsClassic ? "" : "This page only has a cinematic hero"}>Classic</button>
          <button type="button" className={cinematic ? "is-on" : ""} onClick={() => t.supportsCinematic && setStyle("cinematic")} disabled={!t.supportsCinematic} title={t.supportsCinematic ? "" : "This page only has a classic hero"}>Cinematic</button>
        </div>
      </div>
      <div className="g2" style={{ gap: 14 }}>
        <label className="label label-caps">Kicker / eyebrow<input name="kicker" defaultValue={t.kicker} className="admin-input" /></label>
        <label className="label label-caps">CTA button<input name="cta" defaultValue={t.cta} className="admin-input" /></label>
        {cinematic ? (<>
          <label className="label label-caps">Headline lead<input name="lead" defaultValue={t.lead} className="admin-input" placeholder="You deserve" /></label>
          <label className="label label-caps">Headline tail<input name="tail" defaultValue={t.tail} className="admin-input" placeholder="that works as beautifully as you do." /></label>
          <label className="label label-caps">Scenes label (rail)<input name="scenesLabel" defaultValue={t.scenesLabel} className="admin-input" /></label>
          <label className="label label-caps">Seconds per scene<input name="slideSeconds" type="number" min={2} max={20} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 5)} className="admin-input" /></label>
          {t.kind === "page" && <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Sub-headline (optional; replaces per-scene line)<input name="sub" defaultValue={t.sub} className="admin-input" /></label>}
          {t.kind === "page" && t.blockType === "hero" && <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Secondary link text<input name="secondary" defaultValue={t.secondary} className="admin-input" /></label>}
        </>) : (<>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Headline<input name="classicTitle" defaultValue={t.classicTitle} className="admin-input" /></label>
          <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Intro<textarea name="classicSub" rows={3} defaultValue={t.classicSub} className="admin-input" /></label>
          <div style={{ gridColumn: "1/-1" }}><input type="hidden" name="classic_img_initial" value={t.classicImg} /><ImagePicker label="Hero photo" name="classic_img" fileName="classic_file" defaultValue={t.classicImg} width={140} height={90} /></div>
        </>)}
      </div>
      {/* Cinematic fields are always submitted so switching styles never loses data. */}
      {!cinematic && <div hidden><input name="lead" defaultValue={t.lead} /><input name="tail" defaultValue={t.tail} /><input name="scenesLabel" defaultValue={t.scenesLabel} /><input name="slideSeconds" defaultValue={seconds} /></div>}
      {cinematic && <div hidden><input name="classicTitle" defaultValue={t.classicTitle} /><input name="classicSub" defaultValue={t.classicSub} /></div>}
      <div style={{ display: cinematic ? "flex" : "none", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span className="label-caps">Scenes</span><button type="button" className="link-btn" onClick={addScene}>+ Add scene</button></div>
        <span style={{ fontSize: 12, color: "#6b7486" }}>Each scene = photo + highlighted word + one line. Drag to reorder; upload a new photo or pick one from the library.</span>
        {scenes.map((s, i) => s.deleted ? (
          <div key={s.key} hidden><input type="hidden" name={`scene_${i}_delete`} value="1" /></div>
        ) : (
          <div key={s.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null && drag !== i) move(drag, i); setDrag(null); }} style={{ display: "grid", gridTemplateColumns: "20px 170px 1fr auto", gap: 12, alignItems: "start", padding: 12, borderRadius: 12, border: "1px solid #eef0f4", background: "#fff", opacity: drag === i ? .5 : 1 }}>
            <span style={{ cursor: "grab", color: "#c6cbd6", paddingTop: 30 }} aria-hidden>⋮⋮</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <ImagePicker name={`scene_${i}_img`} fileName={`scene_${i}_file`} value={s.img} onChange={(img) => update(s.key, { img })} layout="stack" width={120} height={80} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="label label-caps">Scene name<input name={`scene_${i}_name`} value={s.name} onChange={(e) => update(s.key, { name: e.target.value })} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps">Highlighted word<input name={`scene_${i}_word`} value={s.word} onChange={(e) => update(s.key, { word: e.target.value })} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Line<input name={`scene_${i}_line`} value={s.line} onChange={(e) => update(s.key, { line: e.target.value })} className="admin-input admin-input-sm" /></label>
              <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Link (optional)<input name={`scene_${i}_href`} value={s.href} onChange={(e) => update(s.key, { href: e.target.value })} className="admin-input admin-input-sm" placeholder="/services/residential" /></label>
            </div>
            <button type="button" className="link-btn link-danger" onClick={() => update(s.key, { deleted: true })} style={{ paddingTop: 30 }}>Remove</button>
          </div>))}
        {!live.length && <span style={{ fontSize: 13, color: "#9a3c1e" }}>Add at least one scene before publishing a cinematic hero.</span>}
      </div>
      {t.kind === "service" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #eef0f4", paddingTop: 14 }}>
          <span className="label-caps">Before / after</span>
          <span style={{ fontSize: 12, color: "#6b7486" }}>Shown on cinematic heroes. Use a matching pair from one project — upload or pick from the library.</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(["before", "after"] as const).map((k) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <ImagePicker label={k === "before" ? "Before photo" : "After photo"} name={`${k}_img`} fileName={`${k}_file`} defaultValue={t.beforeAfter?.[k] || ""} layout="stack" width="100%" height={110} />
              </div>))}
            <label className="label label-caps" style={{ gridColumn: "1/-1" }}>Caption<input name="ba_title" defaultValue={t.beforeAfter?.title || ""} className="admin-input admin-input-sm" placeholder="Primary bath · Marietta" /></label>
            {t.beforeAfter && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}><input type="checkbox" name="ba_remove" />Remove the before / after from this page</label>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center", borderTop: "1px solid #eef0f4", paddingTop: 14 }}>
        <a href={t.href} target="_blank" rel="noreferrer" className="link-btn">Preview page →</a>
        <button type="submit" className="btn btn-navy btn-sm" style={{ borderRadius: 10 }} disabled={cinematic && !live.length}>Publish changes</button>
      </div>
    </form>
  );
}
