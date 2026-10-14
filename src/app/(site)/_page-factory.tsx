import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import { RenderBlocks } from "@/components/site/blocks";
import { getPage } from "@/lib/data/site";
import { canPreview } from "@/lib/auth/session";
import { getSetting } from "@/lib/server/settings";
import type { NavActive } from "@/components/site/SiteNav";

/** Builds a block-rendered page component + metadata for a CMS page key. */
export function cmsPage(key: string, opts: { active: NavActive; sourceKey?: string; heroToggle?: boolean }) {
  async function generateMetadata(): Promise<Metadata> {
    const p = await getPage(key, true);
    const description = p?.page.seoDescription || (await getSetting("seo")).defaultDescription || undefined;
    return { title: p?.page.seoTitle ? { absolute: p.page.seoTitle } : p?.page.title, description, alternates: { canonical: p?.page.slug || undefined } };
  }
  async function Page({ searchParams }: { searchParams: Promise<{ preview?: string; from?: string }> }) {
    const sp = await searchParams;
    const data = await getPage(key, await canPreview(sp));
    if (!data) notFound();
    const sourceKey = sp.from || opts.sourceKey || key;
    return (
      <SiteFrame label={data.page.navLabel || data.page.title} active={opts.active} sourceKey={sourceKey} heroToggle={opts.heroToggle ? { kind: "page", key, style: data.page.heroStyle } : undefined}>
        <RenderBlocks blocks={data.blocks} ctx={{ pageKey: key, heroStyle: data.page.heroStyle, sourceKey }} />
      </SiteFrame>
    );
  }
  return { Page, generateMetadata };
}
