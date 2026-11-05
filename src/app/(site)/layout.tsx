import type { Metadata } from "next";
import { getSetting } from "@/lib/server/settings";
import { safeSearchConsoleToken } from "@/lib/google";

/** Public pages: adds the Search Console ownership tag (Admin → Site settings → Google & SEO) to every page's <head>. */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const token = safeSearchConsoleToken((await getSetting("google")).searchConsoleToken);
    return token ? { verification: { google: token } } : {};
  } catch (e) {
    console.error("[google] settings unavailable, skipping Search Console tag:", (e as Error).message);
    return {};
  }
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
