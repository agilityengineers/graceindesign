import Script from "next/script";
import { safeGaId, safeGtmId } from "@/lib/google";

/**
 * Google Analytics 4 and/or Google Tag Manager for public pages (rendered by SiteFrame).
 * IDs are re-checked here, so only Google's exact ID shapes ever reach the inline script.
 */
export default function GoogleTags({ gaId, gtmId }: { gaId: string; gtmId: string }) {
  const ga = safeGaId(gaId);
  const gtm = safeGtmId(gtmId);
  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`}</Script>
        </>
      )}
      {gtm && (
        <>
          <Script id="gtm-init" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtm)});`}</Script>
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" /></noscript>
        </>
      )}
    </>
  );
}
