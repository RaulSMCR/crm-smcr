"use client";

// Carga condicionada de GA4 y Meta Pixel (LEG-01).
//   • GA4: solo si el consentimiento es "granted".
//   • Meta Pixel: solo con consentimiento Y nunca en rutas sensibles
//     (paneles autenticados, agendado, login, registro, recuperación, verificación).
// Reacciona al consentimiento sin recargar la página (escucha onConsentChange).

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getConsent, onConsentChange } from "@/lib/consent";

// El Meta Pixel NO se carga en estas rutas aunque haya consentimiento.
const PIXEL_EXCLUDED = [
  /^\/panel(\/|$)/,
  /^\/agendar(\/|$)/,
  /^\/ingresar$/,
  /^\/registro(\/|$)/,
  /^\/recuperar$/,
  /^\/verificar-email$/,
];

export default function AnalyticsLoader({ gaId, metaPixelId, googleAdsId }) {
  const pathname = usePathname();
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setGranted(getConsent() === "granted");
    return onConsentChange((value) => setGranted(value === "granted"));
  }, []);

  const pixelAllowedHere = !PIXEL_EXCLUDED.some((re) => re.test(pathname || ""));

  // Un solo gtag.js sirve para GA4 y Google Ads: se carga si hay al menos uno y
  // se configura cada destino por separado. Google Ads (ad_storage) respeta el
  // Consent Mode, y además este bloque solo se monta con consentimiento "granted".
  const gtagPrimaryId = gaId || googleAdsId;

  return (
    <>
      {granted && gtagPrimaryId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagPrimaryId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-config" strategy="afterInteractive">
            {[
              gaId && `gtag('config', '${gaId}');`,
              googleAdsId && `gtag('config', '${googleAdsId}');`,
            ]
              .filter(Boolean)
              .join("\n")}
          </Script>
        </>
      )}

      {granted && metaPixelId && pixelAllowedHere && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
