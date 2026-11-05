import type { Metadata, Viewport } from "next";
import { Montserrat, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Grace In Design", template: "%s · Grace In Design" },
  description:
    "Interior design, Aging In Place and project management in Atlanta. Certified Aging-in-Place Specialists.",
  metadataBase: new URL(process.env.BASE_URL || "http://localhost:5000"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1a2238" };

// Google Analytics / Tag Manager load on public pages only: see src/components/site/SiteFrame.tsx (IDs set in Admin → Site settings → Google & SEO).

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${montserrat.variable} ${cormorant.variable}`}>
      {/* Extensions such as Grammarly add body attributes before hydration.
          Suppress only this element's attribute warning, not child mismatches. */}
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
