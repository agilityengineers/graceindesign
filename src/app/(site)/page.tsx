import { canPreview } from "@/lib/auth/session";
import type { Metadata } from "next";
import SiteFrame from "@/components/site/SiteFrame";
import { RenderBlocks } from "@/components/site/blocks";
import { getPage } from "@/lib/data/site";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const p = await getPage("home"); return { title: { absolute: p?.page.seoTitle || "Grace In Design" }, description: p?.page.seoDescription || undefined, alternates: { canonical: "/" } }; }

export default async function HomePage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const sp = await searchParams;
  const data = await getPage("home", await canPreview(sp));
  if (!data) notFound();
  return (
    <SiteFrame label={data.page.navLabel || undefined} active="home" sourceKey="home" heroToggle={{ kind: "page", key: "home", style: data.page.heroStyle }}>
      <RenderBlocks blocks={data.blocks} ctx={{ pageKey: "home", heroStyle: data.page.heroStyle, sourceKey: "home" }} />
    </SiteFrame>
  );
}
