import { getEventBySlug } from "@/lib/data/site";
import { isBeaconKind } from "@/lib/event-stats";
import { countEventRequest } from "@/lib/server/event-stats-request";
export const dynamic = "force-dynamic";

/** The event page reports a view (once per tab session) or a share-button click. Always answers 204; nothing to show. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let kind: unknown; try { kind = (await req.json())?.kind; } catch { kind = null; }
  if (isBeaconKind(kind)) { const e = await getEventBySlug(slug); if (e) await countEventRequest(req, e, kind); }
  return new Response(null, { status: 204 });
}
