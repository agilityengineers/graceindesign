import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("news", { active: "news", sourceKey: "general", heroToggle: false, feed: { title: "Grace In Design — News & Insights", href: "/news/rss.xml" } });
export { generateMetadata };
export default Page;
