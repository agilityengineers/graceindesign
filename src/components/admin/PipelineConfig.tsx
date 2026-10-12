import Link from "next/link";
import { Card } from "./ui";
import ConfirmButton from "./Confirm";
import Sortable from "./Sortable";
import { addPhase, updatePhase, deletePhase, addStage, updateStage, deleteStage, reorderStages, reorderPhases, addProjectField, projectFieldAction, saveConversionRules } from "@/lib/actions/projects";
import type { ConversionRules } from "@/lib/server/settings";

type Phase = { id: number; name: string; color: string; stages: { id: number; name: string; automation: string; count: number }[] };
type Field = { id: number; key: string; label: string; type: string; enabled: boolean };
const AUTOMATION_LABELS: Record<string, string> = { none: "No automation", request_deposit: "Request deposit", send_invoice: "Send invoice", client_approval: "Client approval needed", schedule_install: "Schedule install", request_review: "Request review" };
const FIELD_TYPES = ["currency", "file", "address", "date", "user", "longtext", "number", "toggle", "text"];

export default function PipelineConfig({ phases, fields, rules }: { phases: Phase[]; fields: Field[]; rules: ConversionRules }) {
  const allStages = phases.flatMap((p) => p.stages.map((s) => ({ ...s, phase: p.name })));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }} className="g2">
      <Card title="Phases & stages" sub="Proposed process. Add, rename, reorder or remove stages; group them under phases. Changes apply to the board immediately." action={<Link href="/admin/projects" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>← Back to board</Link>}>
        <Sortable ids={phases.map((p) => p.id)} onReorder={reorderPhases} gap={14} handleTop>
          {phases.map((ph) => (
            <div key={ph.id} style={{ border: "1px solid #e3e6ec", borderRadius: 12, overflow: "hidden" }}>
              <form action={updatePhase} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f7f9fc", borderBottom: "1px solid #eef0f4" }}>
                <input type="hidden" name="phaseId" value={ph.id} />
                <input type="color" name="color" defaultValue={ph.color} style={{ width: 28, height: 28, border: 0, background: "transparent", padding: 0, cursor: "pointer" }} aria-label="Phase colour" />
                <input name="name" defaultValue={ph.name} className="admin-input admin-input-sm" style={{ maxWidth: 220, fontWeight: 700 }} aria-label="Phase name" />
                <button type="submit" className="link-btn">Save</button>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#8c95a8" }}>{ph.stages.reduce((a, s) => a + s.count, 0)} projects</span>
              </form>
              <div style={{ padding: 12 }}>
                <Sortable ids={ph.stages.map((s) => s.id)} onReorder={reorderStages.bind(null, ph.id)} gap={6}>
                  {ph.stages.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <form action={updateStage} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <input type="hidden" name="stageId" value={s.id} />
                        <input name="name" defaultValue={s.name} className="admin-input admin-input-sm" style={{ flex: 1, minWidth: 140 }} aria-label="Stage name" />
                        <select name="automation" defaultValue={s.automation} className="admin-input admin-input-sm" style={{ width: 190 }} aria-label="Automation">{Object.entries(AUTOMATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                        <button type="submit" className="link-btn">Save</button>
                      </form>
                      <span style={{ fontSize: 11, color: "#8c95a8", whiteSpace: "nowrap" }}>{s.count} project{s.count === 1 ? "" : "s"}</span>
                      <form action={deleteStage} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="hidden" name="stageId" value={s.id} />
                        {s.count > 0 && <select name="moveTo" className="admin-input admin-input-sm" style={{ width: 150 }} defaultValue="" aria-label="Move projects to"><option value="">Move projects to…</option>{allStages.filter((x) => x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.phase} · {x.name}</option>)}</select>}
                        <ConfirmButton message={s.count > 0 ? `Remove “${s.name}” and move its ${s.count} project(s) to the selected stage?` : `Remove stage “${s.name}”?`}>Remove</ConfirmButton>
                      </form>
                    </div>))}
                </Sortable>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
                  <form action={addStage} style={{ display: "flex", gap: 6 }}><input type="hidden" name="phaseId" value={ph.id} /><input name="name" placeholder="New stage" className="admin-input admin-input-sm" style={{ width: 180 }} /><button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>+ Stage</button></form>
                  <form action={deletePhase}><input type="hidden" name="phaseId" value={ph.id} /><ConfirmButton message={`Remove the “${ph.name}” phase and all its stages?`}>Remove phase</ConfirmButton></form>
                </div>
              </div>
            </div>))}
        </Sortable>
        <form action={addPhase} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 6, borderTop: "1px solid #eef0f4" }}>
          <input name="name" placeholder="Phase name" className="admin-input admin-input-sm" style={{ width: 180 }} required />
          <input name="firstStage" placeholder="First stage" className="admin-input admin-input-sm" style={{ width: 180 }} />
          <input type="color" name="color" defaultValue="#6cb6e6" style={{ width: 34, height: 34, border: 0, background: "transparent", padding: 0 }} aria-label="Colour" />
          <button type="submit" className="btn btn-navy btn-xs" style={{ borderRadius: 8 }}>+ Add phase</button>
        </form>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card title="Project fields" sub="Extra information captured when a lead converts">
          {fields.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <form action={projectFieldAction} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="op" value="update" />
                <input name="label" defaultValue={f.label} className="admin-input admin-input-sm" style={{ flex: 1 }} aria-label="Field label" />
                <select name="type" defaultValue={f.type} className="admin-input admin-input-sm" style={{ width: 110 }} aria-label="Type">{FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                <button type="submit" className="link-btn">Save</button>
              </form>
              <form action={projectFieldAction}><input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="op" value="toggle" /><button type="submit" className={`toggle${f.enabled ? " is-on" : ""}`} aria-label={f.enabled ? "Disable" : "Enable"} /></form>
              <form action={projectFieldAction}><input type="hidden" name="fieldId" value={f.id} /><input type="hidden" name="op" value="delete" /><ConfirmButton message={`Delete the “${f.label}” field?`}>×</ConfirmButton></form>
            </div>))}
          <form action={addProjectField} style={{ display: "flex", gap: 6, alignItems: "center", paddingTop: 6, borderTop: "1px solid #eef0f4" }}>
            <input name="label" placeholder="Field label" className="admin-input admin-input-sm" style={{ flex: 1 }} required />
            <select name="type" className="admin-input admin-input-sm" style={{ width: 110 }} defaultValue="text">{FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <button type="submit" className="btn btn-ghost btn-xs" style={{ borderRadius: 8 }}>+ Add field</button>
          </form>
        </Card>
        <Card title="Conversion rules" sub="What happens when a lead is marked “Signed”">
          <form action={saveConversionRules} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {([["createProjectOnSigned", "Create project when lead is marked “Signed”"], ["moveLeadToWon", "Move lead to stage “Won”"], ["copyAnswers", "Copy form answers & notes to project"], ["requestDepositInvoice", "Request deposit invoice automatically"], ["sendWelcomeEmail", "Send client welcome email (includes portal link)"]] as const).map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>{label}<input type="checkbox" name={k} defaultChecked={rules[k]} /></label>))}
            <button type="submit" className="btn btn-navy btn-xs" style={{ alignSelf: "flex-start", borderRadius: 8 }}>Save rules</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
