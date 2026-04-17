// src/app/layout.js
import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Salud Mental Costa Rica',
  url: 'https://saludmentalcostarica.com',
  logo: 'https://saludmentalcostarica.com/logo.svg',
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

const BASE_URL = 'https://saludmentalcostarica.com';

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    template: '%s | Salud Mental Costa Rica',
  },
  description:
    'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más. Consultas virtuales y presenciales con profesionales verificados.',
  keywords: [
    'salud mental Costa Rica',
    'psicología online',
    'terapia virtual',
    'coaching bienestar',
    'nutrición Costa Rica',
    'profesionales verificados salud mental',
    'consulta psicológica',
  ],
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    locale: 'es_CR',
    url: BASE_URL,
    siteName: 'Salud Mental Costa Rica',
    title: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    description:
      'Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Salud Mental Costa Rica' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Salud Mental Costa Rica — Bienestar con profesionales validados',
    description:
      'Consultas virtuales y presenciales con profesionales verificados en psicología, nutrición y más.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      {process.env.NODE_ENV === 'production' && (
        <>
          {GA_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
              />
              <Script id="ga-init" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_ID}');
                `}
              </Script>
            </>
          )}
          {META_PIXEL_ID && (
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
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
          )}
        </>
      )}
      {/* 1. flex flex-col: Permite organizar header-main-footer verticalmente.
         2. min-h-screen: Asegura que el cuerpo ocupe al menos toda la altura de la ventana.
      */}
      <body className="min-h-screen flex flex-col bg-surface text-neutral-900 antialiased">
        <JsonLd data={ORGANIZATION_SCHEMA} />
        <Header />
        
        {/* flex-grow: Empuja el footer hacia abajo si el contenido es corto.
           Quitamos 'container': Ahora cada página (page.js) decide sus márgenes.
        */}
        <main className="flex-grow">
          {children}
        </main>
        
        <Footer />
      </body>
    </html>
  );
}