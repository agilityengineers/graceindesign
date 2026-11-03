// Plain constants shared by server and client code. Keep this file free of drizzle/pg imports
// so client components can import it without pulling the database driver into the browser bundle.
// Lead board columns are rows in `lead_stages` (Admin → Leads → Board → Manage columns), so a stage is any string key.
// These are the columns every install starts with. The CORE ones are wired into automation (booking a consultation,
// attaching a proposal, signing a project, Call Flow Tracker dispositions), so they can be renamed and recoloured but not deleted.
export type LeadStage = string;
export type LeadStageDef = { key: string; label: string; bg: string; fg: string; autoDeleteDays: number | null };
export const CORE_LEAD_STAGES = ["new", "contacted", "consultation_booked", "proposal_sent", "won", "lost"] as const;
export const DEFAULT_LEAD_STAGES: LeadStageDef[] = [
  { key: "new", label: "New", bg: "#e6f3fc", fg: "#1a2238", autoDeleteDays: null },
  { key: "contacted", label: "Contacted", bg: "#fff4d6", fg: "#7a5a00", autoDeleteDays: null },
  { key: "consultation_booked", label: "Consultation booked", bg: "#e9e4fb", fg: "#4a2fa3", autoDeleteDays: null },
  { key: "proposal_sent", label: "Proposal sent", bg: "#dcefe4", fg: "#1f6b3f", autoDeleteDays: null },
  { key: "won", label: "Won", bg: "#1a2238", fg: "#fff", autoDeleteDays: null },
  { key: "lost", label: "Lost", bg: "#f2f4f7", fg: "#6b7486", autoDeleteDays: null },
  { key: "nurture", label: "Nurture", bg: "#fbe9e2", fg: "#9a3c1e", autoDeleteDays: null },
];
/** Colour choices offered when adding or editing a column: [name, background, text]. */
export const STAGE_PALETTE: [string, string, string][] = [
  ["Sky", "#e6f3fc", "#1a2238"], ["Butter", "#fff4d6", "#7a5a00"], ["Lavender", "#e9e4fb", "#4a2fa3"], ["Mint", "#dcefe4", "#1f6b3f"],
  ["Navy", "#1a2238", "#fff"], ["Grey", "#f2f4f7", "#6b7486"], ["Clay", "#fbe9e2", "#9a3c1e"], ["Rose", "#fde4ea", "#9b1c3c"], ["Charcoal", "#3a3f4b", "#fff"],
];
export const LEAD_STAGES = DEFAULT_LEAD_STAGES.map((s) => s.key);
export const LEAD_STAGE_LABELS: Record<string, string> = Object.fromEntries(DEFAULT_LEAD_STAGES.map((s) => [s.key, s.label]));
export const isCoreLeadStage = (key: string) => (CORE_LEAD_STAGES as readonly string[]).includes(key);
export const USER_ROLES = ["owner", "editor", "sales", "social"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS: Record<UserRole, string> = { owner: "Owner", editor: "Editor", sales: "Sales", social: "Social manager" };
export const BOOKING_STATUSES = ["booked", "done", "no_show", "cancelled"] as const;
export const INVOICE_STATUSES = ["pending", "scheduled", "paid", "void"] as const;
export const PROJECT_STATUSES = ["active", "closed", "archived"] as const;
export const MODERATION_STATUSES = ["pending", "published", "rejected"] as const;
