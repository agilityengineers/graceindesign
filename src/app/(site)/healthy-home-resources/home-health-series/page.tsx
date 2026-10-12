import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("home-health", { active: "hbd", sourceKey: "home-health", heroToggle: false });
export { generateMetadata };
export default Page;
