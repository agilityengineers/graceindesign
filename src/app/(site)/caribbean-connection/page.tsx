import { cmsPage } from "@/app/(site)/_page-factory";
export const dynamic = "force-dynamic";
const { Page, generateMetadata } = cmsPage("caribbean", { active: "caribbean", sourceKey: "caribbean", heroToggle: true });
export { generateMetadata };
export default Page;
