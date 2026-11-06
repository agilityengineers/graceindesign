import { cmsPage } from "@/app/(site)/_page-factory";
import { ensurePartnersPage } from "@/lib/server/partners";
export const dynamic = "force-dynamic";
// A curated directory of independent professionals (Admin → Content → Partner directory), built from page blocks in
// Admin → Content → Pages → AIP Partners. It used to be the "aip-partners" service landing with a consultation form.
const { Page, generateMetadata } = cmsPage("aip-partners", { active: "hbd", sourceKey: "aip-partners", heroToggle: false, ensure: ensurePartnersPage });
export { generateMetadata };
export default Page;
