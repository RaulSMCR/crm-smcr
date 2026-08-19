// src/app/layout.js
import './globals.css';
import Script from 'next/script';
import { Cormorant_Garamond } from 'next/font/google';
import Header from '@/components/PublicHeader';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import ConsentBanner from '@/components/ConsentBanner';
import AnalyticsLoader from '@/components/AnalyticsLoader';
import MarketingAttributionCapture from '@/components/MarketingAttributionCapture';
import { SITE_URL, siteUrl } from '@/lib/site-url';
import { defaultOgImage } from '@/lib/seo';

// Tipografía display (Art Nouveau contenido). Solo para titulares: el cuerpo
// sigue en la sans del sistema. El fallback es serif a propósito, para que si
// Cormorant no carga el contraste tipográfico no desaparezca.
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
});

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Salud Mental Costa Rica',
  url: SITE_URL,
  logo: siteUrl('logo.svg'),
  description: 'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más.',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+506-7129-1909',
    email: 'contacto@saludmentalcostarica.com',
    contactType: 'customer service',
    availableLanguage: 'Spanish',
  },
  sameAs: [
    'https://www.instagram.com/saludmentalcostarica',
    'https://www.facebook.com/saludmentalcostarica',
    'https://www.linkedin.com/company/saludmentalcostarica',
    'https://www.youtube.com/@saludmentalcostarica',
  ],
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

const BASE_URL = SITE_URL;

// Tarjeta social por defecto, para cualquier ruta que no defina la suya. Se
// genera en /og; antes esto apuntaba a /og-image.png, que no existía.
const OG_POR_DEFECTO = defaultOgImage(
  'Salud Mental Costa Rica',
  'Bienestar con profesionales validados'
);

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    template: '%s | Salud Mental Costa Rica',
  },
  description:
    'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más. Consultas virtuales y presenciales con profesionales verificados.',
  // Sin `keywords` y sin `alternates.canonical` a propósito.
  //
  // `keywords` no lo usa ningún buscador desde hace más de una década, y las
  // mismas siete palabras repetidas en cada página no describían ninguna.
  //
  // El canónico es más serio: en el layout raíz se hereda por toda ruta que no
  // lo redefina, así que decenas de URLs le estaban declarando a Google «la
  // versión buena de esta página es la home». Cada página pública declara el
  // suyo (ver `buildMetadata` en src/lib/seo.js) y las privadas declaran
  // `robots: noindex`, que es lo que corresponde.
  openGraph: {
    type: 'website',
    locale: 'es_CR',
    // Sin `url`: se hereda igual que el canónico y con el mismo efecto.
    siteName: 'Salud Mental Costa Rica',
    title: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    description:
      'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más.',
    images: [{ url: OG_POR_DEFECTO, width: 1200, height: 630, alt: 'Salud Mental Costa Rica' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    description:
      'Consultas virtuales y presenciales con profesionales verificados en psicología, nutrición y más.',
    images: [OG_POR_DEFECTO],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={cormorant.variable}>
      {/* Google Consent Mode v2: por defecto TODO denegado, antes de cargar
          cualquier script de analítica. GA/Pixel se cargan solo tras aceptar
          (ver AnalyticsLoader) y respetan este estado. */}
      {process.env.NODE_ENV === 'production' && (
        <>
          <Script id="consent-default" strategy="beforeInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              gtag('js', new Date());
            `}
          </Script>
        </>
      )}
      {/* 1. flex flex-col: Permite organizar header-main-footer verticalmente.
         2. min-h-screen: Asegura que el cuerpo ocupe al menos toda la altura de la ventana.
      */}
      <body className="min-h-screen flex flex-col bg-surface text-neutral-900 antialiased">
        <MarketingAttributionCapture />
        {process.env.NODE_ENV === 'production' && (
          <AnalyticsLoader gaId={GA_ID} metaPixelId={META_PIXEL_ID} googleAdsId={GOOGLE_ADS_ID} />
        )}
        <JsonLd data={ORGANIZATION_SCHEMA} />
        <Header />
        
        {/* flex-grow: Empuja el footer hacia abajo si el contenido es corto.
           Quitamos 'container': Ahora cada página (page.js) decide sus márgenes.
        */}
        <main className="flex-grow">
          {children}
        </main>

        <Footer />
        <ConsentBanner />
      </body>
    </html>
  );
}
