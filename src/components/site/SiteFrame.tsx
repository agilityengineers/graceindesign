import type { ReactNode } from "react";
import SiteNav, { type NavActive } from "./SiteNav";
import SiteFooter from "./SiteFooter";
import { ConsultProvider } from "./ConsultContext";
import { getSiteChrome } from "@/lib/data/site";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import AdminPreviewPill from "./AdminPreviewPill";

export default async function SiteFrame({ children, label, active = "none", sourceKey = "general", heroToggle }: { children: ReactNode; label?: string; active?: NavActive; sourceKey?: string; heroToggle?: { kind: "page" | "service"; key: string; style: "classic" | "cinematic" } }) {
  const [{ settings, servicesNav }, user] = await Promise.all([getSiteChrome(), getCurrentUser()]);
  const isAdmin = !!user;
  return (
    <ConsultProvider defaultSource={sourceKey}>
      <div className="site-frame">
        <SiteNav label={label || settings.contact.utilityLabel} active={active} sourceKey={sourceKey} phone={settings.contact.phone} email={settings.contact.email} services={servicesNav} />
        {children}
        <SiteFooter contact={settings.contact} footer={settings.footer} social={settings.social_links} isAdmin={isAdmin} etsyUrl={env.etsyShopUrl} />
        {isAdmin && heroToggle && <AdminPreviewPill kind={heroToggle.kind} id={heroToggle.key} style={heroToggle.style} />}
      </div>
    </ConsultProvider>
  );
}
