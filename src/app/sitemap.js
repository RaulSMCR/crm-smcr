import { prisma } from '@/lib/prisma';
import { SITE_URL as BASE_URL } from '@/lib/site-url';

// Sin esto, Next resuelve el sitemap en el build y lo sirve congelado hasta el
// siguiente despliegue: un artículo publicado un martes no aparecía hasta que
// alguien desplegara por otro motivo.
export const revalidate = 3600;

// Las rutas de `/registro*` no están acá a propósito. Son formularios sin
// contenido detrás, ahora declaran `noindex` (ver src/app/registro/layout.js), y
// un sitemap que anuncia páginas que piden no ser indexadas es una contradicción
// que Search Console reporta como error.
const STATIC_PAGES = [
  { url: '/',            priority: 1.0, changeFrequency: 'weekly'  },
  { url: '/servicios',   priority: 0.9, changeFrequency: 'weekly'  },
  { url: '/blog',        priority: 0.8, changeFrequency: 'daily'   },
  { url: '/nosotros',    priority: 0.6, changeFrequency: 'monthly' },
  { url: '/faq',         priority: 0.7, changeFrequency: 'monthly' },
  { url: '/terminos',    priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/privacidad',  priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/cookies',     priority: 0.6, changeFrequency: 'yearly'  },
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_PAGES.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  let services, professionals, posts;

  try {
    [services, professionals, posts] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true, noindex: false },
        select: { id: true, updatedAt: true },
      }),
      prisma.professionalProfile.findMany({
        // El filtro tiene que ser el mismo que el de la página del perfil
        // (src/app/profesionales/[slug]/page.js). Cuando no lo era, el sitemap
        // publicaba perfiles de profesionales dados de baja y esas URLs
        // devolvían 404: le estábamos entregando a Google una lista de páginas
        // rotas en el archivo cuya única función es decir qué páginas existen.
        where: { isApproved: true, noindex: false, user: { is: { isActive: true } } },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED', noindex: false },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch (error) {
    // Antes esto era un `catch {}` vacío que devolvía solo las rutas estáticas.
    // El efecto era que un fallo de base producía un sitemap sin un solo
    // artículo, servicio ni perfil, desplegado a producción, sin que nadie se
    // enterara. Un build roto se ve; un sitemap que se vacía en silencio, no.
    console.error('[sitemap] no se pudo leer el contenido publicado:', error);
    throw error;
  }

  const serviceEntries = services.map(({ id, updatedAt }) => ({
    url: `${BASE_URL}/servicios/${id}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const professionalEntries = professionals.filter(({ slug }) => slug).map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/profesionales/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const postEntries = posts.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...serviceEntries, ...professionalEntries, ...postEntries];
}
