import type { NextConfig } from "next";
// Old graceindesign.net paths → new routes (permanent 301s). Add entries from the old site's sitemap before cutover.
import redirects from "./src/lib/redirects.json";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Generated/stock imagery may be referenced remotely until fetched into public/media.
    remotePatterns: [
      { protocol: "https", hostname: "img.magnific.com" },
      { protocol: "https", hostname: "pikaso.cdnpk.net" },
      { protocol: "https", hostname: "**.etsystatic.com" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  serverExternalPackages: ["pg", "@replit/object-storage", "pdf-lib", "twilio", "@sendgrid/mail", "stripe"],
  async redirects() {
    return (redirects as { source: string; destination: string }[]).map((r) => ({ ...r, permanent: true }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/auth/verify",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
