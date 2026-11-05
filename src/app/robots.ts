import type { MetadataRoute } from "next";

/** Public site is indexable; admin, auth, API and per-client pages (portal, proposal, booking) and event Register redirects (they count clicks) are not. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/auth/", "/login", "/portal/", "/proposal/", "/booking/", "/roadmap", "/unsubscribe", "/p/*?preview=", "/*?preview=1", "/events/*/register"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
