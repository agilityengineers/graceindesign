import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
