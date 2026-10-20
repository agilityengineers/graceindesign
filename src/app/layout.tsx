import type { Metadata, Viewport } from "next";
import { Montserrat, Cormorant_Garamond } from "next/font/google";
import Script from "next/script";
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

// Google Analytics 4 loads only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set (Replit Secrets → publish).
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${cormorant.variable}`}>
      {/* Extensions such as Grammarly add body attributes before hydration.
          Suppress only this element's attribute warning, not child mismatches. */}
      <body suppressHydrationWarning>
        {children}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{anonymize_ip:true});`}</Script>
          </>
        )}
      </body>
    </html>
  );
}
