import Link from "next/link";
import { Card } from "./ui";
import ConfirmButton from "./Confirm";
import { addLeadColumn, updateLeadColumn, deleteLeadColumn, moveLeadColumn } from "@/lib/actions/leads";
import { STAGE_PALETTE, isCoreLeadStage, type LeadStageDef } from "@/lib/db/constants";

/** Admin → Leads → Board → Manage columns: rename, recolour, reorder, add and remove board columns, and set auto-delete (e.g. Trash). */
export default function LeadColumnsConfig({ stages, counts }: { stages: (LeadStageDef & { count: number })[]; counts: { total: number } }) {
  const palette = (bg?: string, fg?: string) => {
    const known = STAGE_PALETTE.some(([, b, f]) => b === bg && f === fg);
    return (<>
      {!known && bg && fg && <option value={`${bg}|${fg}`}>Current colour</option>}
      {STAGE_PALETTE.map(([name, b, f]) => <option key={name} value={`${b}|${f}`}>{name}</option>)}
    </>);
  };
  const swatch = (bg: string, fg: string) => <span aria-hidden style={{ width: 18, height: 18, flex: "none", borderRadius: 6, background: bg, border: `2px solid ${fg}` }} />;
  return (<>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#e6f3fc", fontSize: 12, lineHeight: 1.5 }}>
      <span style={{ flex: 1 }}>These are the columns on the Leads board, left to right. Rename or recolour any of them. Columns you add can also <strong>delete their leads automatically</strong> after a number of days — handy for a “Trash” column. The clock starts when a lead is moved in, and moving it out stops it. Leads that became a project are never auto-deleted.</span>
      <Link href="/admin/leads?view=board" style={{ color: "#3f9ad9", fontWeight: 600, whiteSpace: "nowrap" }}>← Back to board</Link>
    </div>

    <Card title="Board columns" sub={`${stages.length} columns · ${counts.total} lead${counts.total === 1 ? "" : "s"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stages.map((s, i) => {
          const core = isCoreLeadStage(s.key);
          const others = stages.filter((o) => o.key !== s.key);
          return (
            <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, border: "1px solid #e3e6ec", borderRadius: 12 }}>
              <form action={updateLeadColumn} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                <input type="hidden" name="key" value={s.key} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "center" }}>
                  {swatch(s.bg, s.fg)}
                  <span style={{ fontSize: 11, color: "#8c95a8", fontWeight: 600, minWidth: 18 }}>{i + 1}</span>
                </div>
                <label className="label label-caps" style={{ flex: "1 1 180px" }}>Column name<input name="label" defaultValue={s.label} required maxLength={40} className="admin-input admin-input-sm" /></label>
                <label className="label label-caps" style={{ flex: "0 1 140px" }}>Colour<select name="color" defaultValue={`${s.bg}|${s.fg}`} className="admin-input admin-input-sm">{palette(s.bg, s.fg)}</select></label>
                {core ? (
                  <span style={{ fontSize: 11, color: "#8c95a8", alignSelf: "center", maxWidth: 220, lineHeight: 1.4 }}>Built-in — used by bookings, proposals and signing, so it can't be removed or auto-deleted.</span>
                ) : (
                  <div className="label label-caps" style={{ flex: "0 1 220px" }}>Auto-delete
                    <span style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: 12, color: "#4b5569", height: 36 }}>
                      <input type="checkbox" name="autoDelete" value="1" defaultChecked={!!s.autoDeleteDays} aria-label="Delete leads automatically" />
                      after <input type="number" name="autoDeleteDays" min={1} max={3650} defaultValue={s.autoDeleteDays ?? 14} className="admin-input admin-input-sm" style={{ width: 70 }} aria-label="Days" /> days
                    </span>
                  </div>
                )}
                <span style={{ fontSize: 12, color: "#6b7486", alignSelf: "center" }}>{s.count} lead{s.count === 1 ? "" : "s"}</span>
                <button type="submit" className="btn btn-navy btn-sm">Save</button>
              </form>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
                <form action={moveLeadColumn}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="-1" /><button type="submit" className="link-btn" disabled={i === 0} aria-label={`Move ${s.label} left`}>← Move left</button></form>
                <form action={moveLeadColumn}><input type="hidden" name="key" value={s.key} /><input type="hidden" name="dir" value="1" /><button type="submit" className="link-btn" disabled={i === stages.length - 1} aria-label={`Move ${s.label} right`}>Move right →</button></form>
                {!core && (
                  <form action={deleteLeadColumn} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                    <input type="hidden" name="key" value={s.key} />
                    {s.count > 0 && <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7486" }}>Move its {s.count} lead{s.count === 1 ? "" : "s"} to<select name="moveTo" defaultValue="new" className="admin-input admin-input-sm">{others.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>}
                    <ConfirmButton message={`Remove the “${s.label}” column?${s.count ? " Its leads will be moved to the column you picked." : ""}`}>Remove column</ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>

    <Card title="Add a column" sub="New columns appear at the right end of the board — move them wherever you like.">
      <form action={addLeadColumn} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <label className="label label-caps" style={{ flex: "1 1 200px" }}>Column name<input name="label" required maxLength={40} placeholder="e.g. Trash" className="admin-input admin-input-sm" /></label>
        <label className="label label-caps" style={{ flex: "0 1 140px" }}>Colour<select name="color" defaultValue={`${STAGE_PALETTE[5][1]}|${STAGE_PALETTE[5][2]}`} className="admin-input admin-input-sm">{palette()}</select></label>
        <div className="label label-caps" style={{ flex: "0 1 260px" }}>Auto-delete
          <span style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontWeight: 500, fontSize: 12, color: "#4b5569", height: 36 }}>
            <input type="checkbox" name="autoDelete" value="1" aria-label="Delete leads automatically" />
            delete leads after <input type="number" name="autoDeleteDays" min={1} max={3650} defaultValue={14} className="admin-input admin-input-sm" style={{ width: 70 }} aria-label="Days" /> days
          </span>
        </div>
        <button type="submit" className="btn btn-navy btn-sm">+ Add column</button>
      </form>
    </Card>
  </>);
}
