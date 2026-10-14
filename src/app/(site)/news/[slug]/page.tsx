import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFrame from "@/components/site/SiteFrame";
import { PostMeta, PostCard } from "@/components/site/blocks";
import { getPost, getPublishedPosts } from "@/lib/data/site";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const p = await getPost(slug); return p ? { title: p.title, description: p.excerpt || undefined, openGraph: { images: p.imageUrl ? [p.imageUrl] : [] }, alternates: { canonical: `/news/${p.slug}` } } : {}; }
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const p = await getPost(slug); if (!p) notFound();
  const more = (await getPublishedPosts(p.scope as "news" | "caribbean", 4)).filter((x) => x.id !== p.id).slice(0, 3);
  return (
    <SiteFrame label={p.scope === "caribbean" ? "Caribbean Connection" : "News & Insights"} active={p.scope === "caribbean" ? "caribbean" : "news"} sourceKey={p.scope === "caribbean" ? "caribbean" : "general"}>
      <article className="gx" style={{ paddingTop: 72, paddingBottom: 104, maxWidth: 900 }}>
        <Link href={p.scope === "caribbean" ? "/caribbean-connection#blog" : "/news"} className="eyebrow">← {p.scope === "caribbean" ? "Caribbean Blog" : "News & Insights"}</Link>
        <div style={{ height: 18 }} /><PostMeta post={p} />
        <h1 className="h1" style={{ fontSize: 56, margin: "16px 0 24px" }}>{p.title}</h1>
        {p.imageUrl && <div style={{ position: "relative", height: 460, borderRadius: 20, overflow: "hidden", marginBottom: 32 }}><img src={p.imageUrl} alt={p.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /></div>}
        {p.origin === "rss" ? <p className="lede">{p.sourceName && <span style={{ display: "block", fontSize: 13, color: "#6b7486", marginBottom: 12 }}>Originally published by {p.sourceName}</span>}{p.excerpt}{p.sourceUrl && p.sourceUrl !== "#" && <><br /><br /><a href={p.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#3f9ad9", fontWeight: 600 }}>Read the full article at {p.sourceName || "the source"} →</a></>}</p>
          : <div className="prose" style={{ fontSize: 17, lineHeight: 1.75, color: "#4b5569" }} dangerouslySetInnerHTML={{ __html: p.body || `<p>${p.excerpt || ""}</p>` }} />}
      </article>
      {more.length > 0 && <section className="gx" style={{ paddingBottom: 104 }}><h2 className="h2" style={{ fontSize: 34, marginBottom: 32 }}>More to read</h2><div className="g3" style={{ gap: 32 }}>{more.map((m) => <PostCard key={m.id} post={m} height={220} />)}</div></section>}
    </SiteFrame>
  );
}
