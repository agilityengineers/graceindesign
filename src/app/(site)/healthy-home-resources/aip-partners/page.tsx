import { canPreview } from "@/lib/auth/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import ServiceLanding from "@/components/site/ServiceLanding";
import Reveal from "@/components/site/Reveal";
import { getServiceBySlug } from "@/lib/data/site";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const d = await getServiceBySlug("aip-partners", true); return d ? { title: d.service.seoTitle || d.service.title, description: d.service.seoDescription || d.service.sub, alternates: { canonical: "/healthy-home-resources/aip-partners" } } : {}; }
export default async function Page({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const sp = await searchParams; const d = await getServiceBySlug("aip-partners", await canPreview(sp)); if (!d) notFound();
  return <SiteFrame label="Healthy Home Resources · AIP Partners" active="hbd" sourceKey="aip-partners" heroToggle={{ kind: "service", key: "aip-partners", style: d.service.heroStyle }}><ServiceLanding s={d.service as any} all={d.all} heroStyle={d.service.heroStyle} /><Reveal /></SiteFrame>;
}
