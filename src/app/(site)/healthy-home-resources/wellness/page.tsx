import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("wellness", { active: "hbd", sourceKey: "wellness", heroToggle: false });
export { generateMetadata };
export default Page;
