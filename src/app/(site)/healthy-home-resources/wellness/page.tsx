import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("wellness", { active: "hbd", sourceKey: "wellness", heroToggle: false, feed: { title: "Grace In Design — WELLness articles", href: "/news/rss.xml?category=WELLness" } });
export { generateMetadata };
export default Page;
