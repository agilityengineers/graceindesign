import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import { RenderBlocks } from "@/components/site/blocks";
import { getPage } from "@/lib/data/site";
import { canPreview } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
/** Custom pages created in the CMS render here: /p/<key>. */
export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> { const { key } = await params; const p = await getPage(key, true); return p ? { title: p.page.seoTitle ? { absolute: p.page.seoTitle } : p.page.title, description: p.page.seoDescription || undefined } : {}; }
export default async function CustomPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ preview?: string; from?: string }> }) {
  const { key } = await params; const sp = await searchParams;
  const data = await getPage(key, await canPreview(sp)); if (!data) notFound();
  return (
    <SiteFrame label={data.page.navLabel || data.page.title} active="none" sourceKey={sp.from || "general"}>
      <RenderBlocks blocks={data.blocks} ctx={{ pageKey: key, heroStyle: data.page.heroStyle, sourceKey: sp.from || "general" }} />
    </SiteFrame>
  );
}
