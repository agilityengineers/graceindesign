import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("aip-products", { active: "hbd", sourceKey: "aip-products", heroToggle: false });
export { generateMetadata };
export default Page;
