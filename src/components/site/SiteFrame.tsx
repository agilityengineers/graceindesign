import type { ReactNode } from "react";
import SiteNav, { type NavActive } from "./SiteNav";
import SiteFooter from "./SiteFooter";
import { ConsultProvider } from "./ConsultContext";
import { getSiteChrome } from "@/lib/data/site";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import AdminPreviewPill from "./AdminPreviewPill";
import GoogleTags from "./GoogleTags";
import { buildLocalBusinessJsonLd, jsonLdString, reviewUrl } from "@/lib/google";

export default async function SiteFrame({ children, label, active = "none", sourceKey = "general", heroToggle, privatePage = false }: { children: ReactNode; label?: string; active?: NavActive; sourceKey?: string; heroToggle?: { kind: "page" | "service"; key: string; style: "classic" | "cinematic" }; /** Per-person pages (portal, proposal, booking, unsubscribe) and internal ones: no analytics, no business data. */ privatePage?: boolean }) {
  const [{ settings, servicesNav }, user] = await Promise.all([getSiteChrome(), getCurrentUser()]);
  const isAdmin = !!user;
  const g = settings.google;
  // Analytics: admin-entered ID first, then the older Replit Secret. Never on private pages; optionally not for the team.
  const track = !privatePage && !(isAdmin && g.excludeTeam);
  const gaId = g.gaMeasurementId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const businessJsonLd = privatePage ? null : buildLocalBusinessJsonLd({
    baseUrl: env.baseUrl, name: settings.seo.siteName, description: settings.seo.defaultDescription,
    phone: settings.contact.phone, email: settings.contact.email, logoPath: "/assets/logo-dark-transparent.png",
    google: g, sameAs: settings.social_links.filter((l) => l.enabled).map((l) => l.url),
  });
  return (
    <ConsultProvider defaultSource={sourceKey}>
      <div className="site-frame">
        <SiteNav label={label || settings.contact.utilityLabel} active={active} sourceKey={sourceKey} phone={settings.contact.phone} email={settings.contact.email} services={servicesNav} />
        {children}
        <SiteFooter contact={settings.contact} footer={settings.footer} social={settings.social_links} isAdmin={isAdmin} etsyUrl={env.etsyShopUrl} reviewUrl={g.footerReviewLink ? reviewUrl(g.placeId) : ""} />
        {isAdmin && heroToggle && <AdminPreviewPill kind={heroToggle.kind} id={heroToggle.key} style={heroToggle.style} />}
        {businessJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(businessJsonLd) }} />}
        {track && <GoogleTags gaId={gaId} gtmId={g.gtmContainerId} />}
      </div>
    </ConsultProvider>
  );
}
