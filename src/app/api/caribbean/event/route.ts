import { handleEventSubmission } from "@/lib/server/event-submission";
export const dynamic = "force-dynamic";
/** Older endpoint for the Caribbean page's form; same handling as /api/events, Caribbean unless the form says otherwise. */
export async function POST(req: Request) { return handleEventSubmission(req, { region: "caribbean" }); }
