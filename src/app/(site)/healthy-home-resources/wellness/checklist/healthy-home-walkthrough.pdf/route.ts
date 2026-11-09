import { walkthroughPdf } from "@/lib/server/walkthrough";
import { WALKTHROUGH_PDF_FILENAME } from "@/lib/walkthrough";
export const dynamic = "force-dynamic";
/**
 * The checklist PDF at a stable address: the download page's button and the email's link both point here, and it always
 * serves the current file (Grace's published upload, whole, or the generated checklist). Public on purpose: it is a lead
 * magnet, and the link in the email has to work without a token. Not cached, so a publish shows up at once.
 */
export async function GET() {
  const pdf = await walkthroughPdf();
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${WALKTHROUGH_PDF_FILENAME}"`, "cache-control": "no-store" } });
}
