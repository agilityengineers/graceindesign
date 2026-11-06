import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import { RenderBlocks } from "@/components/site/blocks";
import { getPage } from "@/lib/data/site";
import { canPreview } from "@/lib/auth/session";
import { getSetting } from "@/lib/server/settings";
import type { NavActive } from "@/components/site/SiteNav";

/** Builds a block-rendered page component + metadata for a CMS page key. */
/** `ensure` runs before the page is read, e.g. to create a page that databases seeded before it existed do not have.
 *  `feed` advertises an RSS feed in the page's <head> so browsers and feed readers (e.g. RSS.app) can find it. */
export function cmsPage(key: string, opts: { active: NavActive; sourceKey?: string; heroToggle?: boolean; ensure?: () => Promise<void>; feed?: { title: string; href: string } }) {
  async function generateMetadata(): Promise<Metadata> {
    await opts.ensure?.();
    const p = await getPage(key, true);
    const description = p?.page.seoDescription || (await getSetting("seo")).defaultDescription || undefined;
    return { title: p?.page.seoTitle ? { absolute: p.page.seoTitle } : p?.page.title, description, alternates: { canonical: p?.page.slug || undefined, ...(opts.feed ? { types: { "application/rss+xml": [{ url: opts.feed.href, title: opts.feed.title }] } } : {}) } };
  }
  async function Page({ searchParams }: { searchParams: Promise<{ preview?: string; from?: string; category?: string }> }) {
    const sp = await searchParams;
    await opts.ensure?.();
    const data = await getPage(key, await canPreview(sp));
    if (!data) notFound();
    const sourceKey = sp.from || opts.sourceKey || key;
    return (
      <SiteFrame label={data.page.navLabel || data.page.title} active={opts.active} sourceKey={sourceKey} heroToggle={opts.heroToggle ? { kind: "page", key, style: data.page.heroStyle } : undefined}>
        <RenderBlocks blocks={data.blocks} ctx={{ pageKey: key, heroStyle: data.page.heroStyle, sourceKey, category: typeof sp.category === "string" ? sp.category.slice(0, 60) : undefined }} />
      </SiteFrame>
    );
  }
  return { Page, generateMetadata };
}
