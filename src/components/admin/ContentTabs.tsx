import Link from "next/link";
export const CONTENT_TABS = [
  { key: "pages", label: "Pages", href: "/admin/content" },
  { key: "services", label: "Services", href: "/admin/content/services" },
  { key: "posts", label: "News & Insights", href: "/admin/content/posts" },
  { key: "testimonials", label: "Testimonials", href: "/admin/content/testimonials" },
  { key: "team", label: "About & team", href: "/admin/content/team" },
  { key: "media", label: "Media library", href: "/admin/content/media" },
  { key: "settings", label: "Site settings", href: "/admin/content/settings" },
];
export default function ContentTabs({ active }: { active: string }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CONTENT_TABS.map((t) => <Link key={t.key} href={t.href} className={`pill${active === t.key ? " is-on" : ""}`}>{t.label}</Link>)}</div>;
}
