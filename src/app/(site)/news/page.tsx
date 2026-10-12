import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("news", { active: "news", sourceKey: "general", heroToggle: false });
export { generateMetadata };
export default Page;
