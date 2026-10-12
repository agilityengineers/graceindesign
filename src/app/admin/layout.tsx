import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import Toast from "@/components/admin/Toast";
export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s · GID Admin" } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) { const h = await headers(); const path = h.get("x-pathname") || "/admin"; redirect(`/login?next=${encodeURIComponent(path)}`); }
  return <>{children}<Suspense fallback={null}><Toast /></Suspense></>;
}
