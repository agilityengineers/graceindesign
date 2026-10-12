import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireArea, type Area } from "@/lib/auth/session";
import { audit } from "@/lib/server/audit";

/** Common wrapper for admin server actions: auth + audit + redirect with toast. */
export async function adminAction<T>(area: Area, entity: string, action: string, fn: (user: Awaited<ReturnType<typeof requireArea>>) => Promise<T>, opts: { back: string; ok?: string; entityId?: (r: T) => string | number | null | undefined; revalidate?: string[] }) {
  const user = await requireArea(area);
  let result: T;
  try { result = await fn(user); } catch (e: any) { const msg = String(e?.message || e).slice(0, 160); redirect(`${opts.back}${opts.back.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`); }
  await audit(user.id, action, entity, opts.entityId ? opts.entityId(result) : null);
  for (const p of ["/", ...(opts.revalidate || [])]) revalidatePath(p, "layout");
  redirect(`${opts.back}${opts.back.includes("?") ? "&" : "?"}ok=${encodeURIComponent(opts.ok || "Saved")}`);
}
export function backTo(formData: FormData, fallback: string) { const b = String(formData.get("_back") || ""); return b.startsWith("/admin") ? b : fallback; }
