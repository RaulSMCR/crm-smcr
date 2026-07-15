import { SITE_URL, siteUrl } from '@/lib/site-url';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/registro*` queda indexable a propósito: son las páginas de captación
      // y el sitemap las publica. `/panel/` es el área privada real.
      disallow: ['/api/', '/panel/', '/ingresar'],
    },
    sitemap: siteUrl('sitemap.xml'),
    host: SITE_URL,
  };
}
