import prisma from '@/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://smcr.cr';

const STATIC_PAGES = [
  { url: '/',                      priority: 1.0, changeFrequency: 'weekly'  },
  { url: '/servicios',             priority: 0.9, changeFrequency: 'weekly'  },
  { url: '/blog',                  priority: 0.8, changeFrequency: 'daily'   },
  { url: '/nosotros',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/contacto',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/ingresar',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/registro',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/registro/profesional',  priority: 0.6, changeFrequency: 'monthly' },
  { url: '/terminos',              priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/privacidad',            priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/cookies',               priority: 0.6, changeFrequency: 'yearly'  },
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_PAGES.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const [services, professionals, posts] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
    }),
    prisma.professionalProfile.findMany({
      where: { isApproved: true },
      select: { id: true, updatedAt: true },
    }),
    prisma.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const serviceEntries = services.map(({ id, updatedAt }) => ({
    url: `${BASE_URL}/servicios/${id}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const professionalEntries = professionals.map(({ id, updatedAt }) => ({
    url: `${BASE_URL}/agendar/${id}`,
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
