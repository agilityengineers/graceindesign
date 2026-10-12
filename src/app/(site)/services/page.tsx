import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("services", { active: "services", sourceKey: "services", heroToggle: true });
export { generateMetadata };
export default Page;
