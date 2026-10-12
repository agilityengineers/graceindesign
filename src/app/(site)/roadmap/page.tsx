import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import SiteFrame from "@/components/site/SiteFrame";
import RoadmapContent from "@/components/site/RoadmapContent";
export const dynamic = "force-dynamic";
export const metadata = { title: "Build roadmap" };
export default async function RoadmapPage() {
  const u = await getCurrentUser(); if (!u) redirect("/login?next=/roadmap");
  return <SiteFrame label="Build plan · internal" active="none" sourceKey="general"><RoadmapContent /></SiteFrame>;
}
