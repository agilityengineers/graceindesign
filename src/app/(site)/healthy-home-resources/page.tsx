import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("hhr", { active: "hbd", sourceKey: "hhr", heroToggle: true });
export { generateMetadata };
export default Page;
