import { handleEventSubmission } from "@/lib/server/event-submission";
export const dynamic = "force-dynamic";
/** Every public "Submit an event" form posts here (Caribbean page, United States pages, any events block with its form on). */
export async function POST(req: Request) { return handleEventSubmission(req); }
