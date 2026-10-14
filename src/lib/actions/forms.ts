"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, formFields, paths } from "@/lib/db";
import { requireArea } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";
import { adminAction, backTo } from "./_util";
import { str, strOrNull, parseNum, bool, slugify } from "@/lib/utils";
import { getSetting, setSetting } from "@/lib/server/settings";

const TYPES = ["text", "email", "phone", "select", "multiselect", "yesno", "textarea", "upload", "date", "address", "consent"];
const STEPS = ["path", "project", "contact", "schedule", "review"];
const REVAL = ["/admin/forms", "/contact", "/services"];
const parseOptions = (v: FormDataEntryValue | null) => str(v).split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);

export async function addFormField(formData: FormData) {
  const back = backTo(formData, "/admin/forms");
  await adminAction("forms", "form_field", "create", async () => {
    const label = str(formData.get("label")); if (!label) throw new Error("Label is required");
    const type = TYPES.includes(str(formData.get("type"))) ? str(formData.get("type")) : "text";
    const scope = str(formData.get("scope")) === "path" ? "path" : "base";
    const pathId = scope === "path" ? strOrNull(formData.get("pathId")) : null; if (scope === "path" && !pathId) throw new Error("Pick an audience for this question");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(formFields).where(scope === "path" ? and(eq(formFields.scope, "path"), eq(formFields.pathId, pathId!)) : eq(formFields.scope, "base"));
    const base = slugify(label).replace(/-/g, "_").slice(0, 40) || "q";
    const [f] = await db.insert(formFields).values({ key: `${base}_${Math.random().toString(36).slice(2, 6)}`, label, type, options: ["select", "multiselect"].includes(type) ? parseOptions(formData.get("options")) : type === "yesno" ? ["Yes", "No"] : [], placeholder: strOrNull(formData.get("placeholder")), required: bool(formData.get("required")), scope, pathId, step: STEPS.includes(str(formData.get("step"))) ? str(formData.get("step")) : scope === "path" ? "project" : "project", sort: Number(n) }).returning();
    return f;
  }, { back, ok: "Question added", entityId: (f) => f.id, revalidate: REVAL });
}
export async function updateFormField(formData: FormData) {
  const id = parseNum(formData.get("fieldId")); const back = backTo(formData, "/admin/forms");
  await adminAction("forms", "form_field", "update", async () => {
    const type = str(formData.get("type"));
    await db.update(formFields).set({ label: str(formData.get("label")) || undefined, type: TYPES.includes(type) ? type : undefined, options: formData.has("options") ? parseOptions(formData.get("options")) : undefined, placeholder: formData.has("placeholder") ? strOrNull(formData.get("placeholder")) : undefined, required: bool(formData.get("required")), step: STEPS.includes(str(formData.get("step"))) ? str(formData.get("step")) : undefined, updatedAt: new Date() }).where(eq(formFields.id, id));
    return id;
  }, { back, ok: "Question saved", entityId: () => id, revalidate: REVAL });
}
export async function formFieldAction(formData: FormData) {
  const id = parseNum(formData.get("fieldId")); const op = str(formData.get("op")); const back = backTo(formData, "/admin/forms");
  await adminAction("forms", "form_field", op, async () => {
    if (op === "delete") await db.delete(formFields).where(eq(formFields.id, id));
    else if (op === "required") await db.update(formFields).set({ required: sql`not ${formFields.required}`, updatedAt: new Date() }).where(eq(formFields.id, id));
    else if (op === "visible") await db.update(formFields).set({ visible: sql`not ${formFields.visible}`, updatedAt: new Date() }).where(eq(formFields.id, id));
    return id;
  }, { back, ok: op === "delete" ? "Question deleted" : "Question updated", entityId: () => id, revalidate: REVAL });
}
export async function reorderFormFields(ids: number[]) {
  const user = await requireArea("forms");
  for (const [i, id] of ids.entries()) await db.update(formFields).set({ sort: i }).where(eq(formFields.id, id));
  await audit(user.id, "reorder", "form_field", null, { ids });
  for (const p of REVAL) revalidatePath(p, "layout");
  return { ok: true };
}
export async function saveFormSettings(formData: FormData) {
  await adminAction("forms", "setting", "update", async () => {
    const n = await getSetting("notifications"); const c = await getSetting("consult_form");
    await setSetting("notifications", {
      ...n,
      emailAdminOnNewLead: bool(formData.get("emailAdminOnNewLead")),
      salesEmail: str(formData.get("salesEmail")) || n.salesEmail,
      adminEmail: str(formData.get("adminEmail")) || n.adminEmail,
      smsAdminOnNewLead: bool(formData.get("smsAdminOnNewLead")),
      adminPhone: str(formData.get("adminPhone")),
      slackOnNewLead: bool(formData.get("slackOnNewLead")),
      slackOnOtherForms: bool(formData.get("slackOnOtherForms")),
      slackOnCftEvents: bool(formData.get("slackOnCftEvents")),
      cftLinkInSlack: bool(formData.get("cftLinkInSlack")),
      cftUserEmail: str(formData.get("cftUserEmail")).toLowerCase() || n.cftUserEmail,
    });
    await setSetting("consult_form", { ...c, mode: str(formData.get("mode")) === "single" ? "single" : "wizard", allowVisitorToggle: bool(formData.get("allowVisitorToggle")) });
    return "notifications";
  }, { back: "/admin/forms", ok: "Form settings saved", entityId: (k) => k, revalidate: REVAL });
}
export async function savePath(formData: FormData) {
  const id = str(formData.get("pathId")); const back = backTo(formData, "/admin/forms");
  await adminAction("forms", "path", id ? "update" : "create", async () => {
    const label = str(formData.get("label")); if (!label) throw new Error("Label is required");
    const pageKeys = str(formData.get("pageKeys")).split(",").map((s) => s.trim()).filter(Boolean);
    if (id) { await db.update(paths).set({ label, short: str(formData.get("short")) || label, consultType: str(formData.get("consultType")) || "15-min discovery call", color: str(formData.get("color")) || "#6cb6e6", pageKeys, isActive: bool(formData.get("isActive")) }).where(eq(paths.id, id)); return id; }
    const newId = slugify(str(formData.get("id")) || label); if (!newId) throw new Error("Give the audience an id");
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(paths);
    await db.insert(paths).values({ id: newId, label, short: str(formData.get("short")) || label, consultType: str(formData.get("consultType")) || "15-min discovery call", color: str(formData.get("color")) || "#6cb6e6", pageKeys, sort: Number(n), isActive: true });
    return newId;
  }, { back, ok: "Audience saved", entityId: (k) => k, revalidate: REVAL });
}
export async function deletePath(formData: FormData) {
  const id = str(formData.get("pathId"));
  await adminAction("forms", "path", "delete", async () => { await db.delete(paths).where(eq(paths.id, id)); return id; }, { back: "/admin/forms", ok: "Audience removed (its questions were deleted; leads keep their answers)", entityId: (k) => k, revalidate: REVAL });
}
