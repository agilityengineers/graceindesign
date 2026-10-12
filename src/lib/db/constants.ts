// Plain constants shared by server and client code. Keep this file free of drizzle/pg imports
// so client components can import it without pulling the database driver into the browser bundle.
export const LEAD_STAGES = ["new", "contacted", "consultation_booked", "proposal_sent", "won", "lost", "nurture"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New", contacted: "Contacted", consultation_booked: "Consultation booked", proposal_sent: "Proposal sent", won: "Won", lost: "Lost", nurture: "Nurture",
};
export const USER_ROLES = ["owner", "editor", "sales", "social"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_ROLE_LABELS: Record<UserRole, string> = { owner: "Owner", editor: "Editor", sales: "Sales", social: "Social manager" };
export const BOOKING_STATUSES = ["booked", "done", "no_show", "cancelled"] as const;
export const INVOICE_STATUSES = ["pending", "scheduled", "paid", "void"] as const;
export const PROJECT_STATUSES = ["active", "closed", "archived"] as const;
export const MODERATION_STATUSES = ["pending", "published", "rejected"] as const;
