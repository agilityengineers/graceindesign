import { canPreview } from "@/lib/auth/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import ServiceLanding from "@/components/site/ServiceLanding";
import Reveal from "@/components/site/Reveal";
import { getServiceBySlug } from "@/lib/data/site";

export const dynamic = "force-dynamic";
const ALIAS: Record<string, string> = { "residential": "residential", "residential/design-refresh": "design-refresh", "residential/model-home": "model-home", "aging-in-place": "aging-in-place", "aging-in-place/virtual": "virtual-assessment", "aging-in-place/virtual-assessment": "virtual-assessment", "commercial": "commercial", "project-management": "project-management", "start": "general", "general": "general", "design-refresh": "design-refresh", "model-home": "model-home", "virtual-assessment": "virtual-assessment" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params; const key = ALIAS[slug.join("/")]; if (!key) return {};
  const d = await getServiceBySlug(key, true); return d ? { title: d.service.seoTitle || d.service.title, description: d.service.seoDescription || d.service.sub } : {};
}
export default async function ServicePage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params; const sp = await searchParams;
  const key = ALIAS[slug.join("/")]; if (!key) notFound();
  const d = await getServiceBySlug(key, await canPreview(sp)); if (!d) notFound();
  return (
    <SiteFrame label={d.service.title} active="services" sourceKey={key} heroToggle={{ kind: "service", key, style: d.service.heroStyle }}>
      <ServiceLanding s={d.service as any} all={d.all} heroStyle={d.service.heroStyle} />
      <Reveal />
    </SiteFrame>
  );
}
