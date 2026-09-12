import { prisma } from '@/lib/prisma';
import { SITE_URL as BASE_URL } from '@/lib/site-url';
import { getPublishedHubTopicsAsync, hubLastModifiedAsync } from '@/lib/hub-raul';

// Sin esto, Next resuelve el sitemap en el build y lo sirve congelado hasta el
// siguiente despliegue: un artículo publicado un martes no aparecía hasta que
// alguien desplegara por otro motivo.
export const revalidate = 3600;

// Las rutas de `/registro*` no están acá a propósito. Son formularios sin
// contenido detrás, ahora declaran `noindex` (ver src/app/registro/layout.js), y
// un sitemap que anuncia páginas que piden no ser indexadas es una contradicción
// que Search Console reporta como error.
// `lastModified` va solo donde hay una fecha real detrás.
//
// Antes todas estas entradas se sellaban con `new Date()` en cada pedido: once
// URLs, la home incluida, le declaraban a Google "me modificaron hace un
// segundo", en cada visita, para siempre. Google documenta que cuando los
// `lastmod` no son fiables deja de usarlos, y un archivo que miente en once de
// cincuenta y cuatro entradas enseña exactamente eso.
//
// `fuente` dice de dónde sale la fecha: 'contenido' la deriva de lo más reciente
// que esa página lista, y `null` significa que no la sabemos — y entonces no se
// declara. Omitir el campo es información; inventarlo es ruido.
const STATIC_PAGES = [
  { url: '/',            priority: 1.0, changeFrequency: 'weekly',  fuente: 'todo' },
  { url: '/servicios',   priority: 0.9, changeFrequency: 'weekly',  fuente: 'servicios' },
  { url: '/blog',        priority: 0.8, changeFrequency: 'daily',   fuente: 'posts' },
  { url: '/profesionales', priority: 0.8, changeFrequency: 'monthly', fuente: 'profesionales' },
  { url: '/faq',         priority: 0.7, changeFrequency: 'monthly', fuente: null },
  { url: '/terminos',    priority: 0.6, changeFrequency: 'yearly',  fuente: null },
  { url: '/privacidad',  priority: 0.6, changeFrequency: 'yearly',  fuente: null },
  { url: '/cookies',     priority: 0.6, changeFrequency: 'yearly',  fuente: null },
  { url: '/raul-olmedo-evans', priority: 0.9, changeFrequency: 'weekly', fuente: 'hub' },
  { url: '/raul-olmedo-evans/tratamiento-breve-15-sesiones', priority: 0.8, changeFrequency: 'monthly', fuente: 'hub' },
  { url: '/ayuda-inmediata', priority: 0.5, changeFrequency: 'yearly', fuente: null },
];

/** La más reciente de una lista de fechas, o `undefined` si no hay ninguna. */
function masReciente(...fechas) {
  const validas = fechas.flat().filter(Boolean).map((f) => new Date(f)).filter((f) => !Number.isNaN(f.getTime()));
  return validas.length ? new Date(Math.max(...validas.map((f) => f.getTime()))) : undefined;
}

export default async function sitemap() {
  let services, professionals, posts, series, temas, topicHubs;

  try {
    [services, professionals, posts, series, temas, topicHubs] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true, noindex: false },
        select: { slug: true, updatedAt: true },
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
      // Las series tienen página propia en /blog/serie/[slug] y quedaban fuera
      // del sitemap: cinco páginas indexables, con contenido agrupado y en
      // orden, que Google solo podía encontrar por enlace interno.
      //
      // El filtro repite el de la página (`isActive` y posts publicados con
      // `seriesApproved`) por la misma razón que se anotó arriba para los
      // perfiles: anunciar una serie vacía es entregar una URL sin contenido.
      prisma.series.findMany({
        where: {
          isActive: true,
          posts: { some: { status: 'PUBLISHED', seriesApproved: true, noindex: false } },
        },
        select: { slug: true, updatedAt: true },
      }),
      // Temas: archivo transversal en /blog/tema/[slug]. Mismo criterio que las
      // series — solo los que tienen al menos un artículo aprobado y publicado,
      // porque la página devuelve 404 cuando queda vacía.
      prisma.topic.findMany({
        where: {
          isActive: true,
          posts: { some: { status: 'APPROVED', post: { status: 'PUBLISHED', noindex: false } } },
        },
        select: { slug: true, updatedAt: true },
      }),
      prisma.topic.findMany({
        where: { status: 'PUBLISHED', isActive: true },
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

  const serviceEntries = services.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/servicios/${slug}`,
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

  // Prioridad por debajo del artículo: la serie es una puerta de entrada, pero
  // lo que se quiere posicionar es cada ensayo.
  const seriesEntries = series.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/blog/serie/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const temaEntries = temas.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/blog/tema/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const topicHubEntries = topicHubs.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  // Solo los temas con cuerpo. El sitemap es la lista de lo que el sitio afirma
  // que vale la pena indexar; incluir una página "en preparación" contradice esa
  // afirmación y gasta el presupuesto de rastreo en nada.
  const raulTopics = (await getPublishedHubTopicsAsync()).filter((topic) => topic.body);
  const raulTopicEntries = await Promise.all(raulTopics.map(async ({ slug }) => ({
    url: `${BASE_URL}/raul-olmedo-evans/${slug}`,
    lastModified: await hubLastModifiedAsync(`raul-olmedo-evans/${slug}`),
    changeFrequency: 'monthly',
    priority: 0.8,
  })));

  // Las fechas de las portadas salen de lo que cada una lista. La del hub la
  // calcula `hubLastModifiedAsync`, que ya sabe leer su módulo más reciente.
  const fechaHub = await hubLastModifiedAsync('raul-olmedo-evans');
  const fechas = {
    servicios: masReciente(services.map((s) => s.updatedAt)),
    posts: masReciente(posts.map((p) => p.updatedAt)),
    profesionales: masReciente(professionals.map((p) => p.updatedAt)),
    hub: fechaHub,
  };
  fechas.todo = masReciente([fechas.servicios, fechas.posts, fechas.profesionales, fechas.hub]);

  const staticEntries = STATIC_PAGES.map(({ url, priority, changeFrequency, fuente }) => {
    const lastModified = fuente ? fechas[fuente] : undefined;
    return {
      url: `${BASE_URL}${url}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    };
  });

  return [
    ...staticEntries,
    ...serviceEntries,
    ...professionalEntries,
    ...postEntries,
    ...seriesEntries,
    ...temaEntries,
    ...topicHubEntries.filter(({ url }) => !url.includes('/raul-olmedo')),
    ...raulTopicEntries,
  ];
}
