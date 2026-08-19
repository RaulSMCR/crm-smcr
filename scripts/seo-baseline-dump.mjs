// scripts/seo-baseline-dump.mjs
//
// S0 del plan de reparación SEO/GEO: congela el estado de producción antes de
// tocar cualquier slug.
//
// Produce dos archivos en docs/backups/ (directorio ignorado por git: lleva
// correos y nombres reales):
//
//   pre-seo-{fecha}.json        respaldo de las tablas que la cadena S4–S6 va a
//                               modificar, con todas sus columnas
//   urls-produccion-{fecha}.txt inventario de URLs públicas, una por línea
//
// Solo lee. No escribe nada en la base.
//
// Desviación respecto del plan: el plan pedía un dump `.sql` con pg_dump, que no
// está disponible en este entorno. El JSON cumple la misma función —restaurar un
// slug perdido— y además es directamente consumible por el `--revert` de S4.
// De `User` se guarda únicamente el subconjunto de columnas que la cadena de
// slugs necesita: el resto (hash de contraseña, teléfono, datos de paciente) no
// tiene por qué salir de la base.

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://saludmentalcostarica.com').replace(/\/+$/, '');
const FECHA = new Date().toISOString().slice(0, 10);
const DIR = 'docs/backups';

// Rutas estáticas públicas. Se listan a mano porque el sitemap actual mezcla
// rutas que S1 va a sacar (las de /registro) y no sirve como fuente de verdad.
const ESTATICAS = [
  '/', '/servicios', '/blog', '/nosotros', '/faq',
  '/terminos', '/privacidad', '/cookies',
  '/registro', '/registro/profesional', '/registro/usuario',
];

async function main() {
  mkdirSync(DIR, { recursive: true });

  const [posts, perfiles, servicios, usuarios] = await Promise.all([
    prisma.post.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.professionalProfile.findMany({
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    }),
    prisma.service.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'PROFESSIONAL'] } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const respaldo = {
    generadoEn: new Date().toISOString(),
    base: BASE,
    nota: 'Respaldo S0 previo a la cadena S2-S6. Columnas completas salvo User (subconjunto).',
    conteos: {
      post: posts.length,
      professionalProfile: perfiles.length,
      service: servicios.length,
      user: usuarios.length,
    },
    tablas: { Post: posts, ProfessionalProfile: perfiles, Service: servicios, User: usuarios },
  };

  const rutaRespaldo = `${DIR}/pre-seo-${FECHA}.json`;
  writeFileSync(rutaRespaldo, JSON.stringify(respaldo, null, 2), 'utf8');

  // Inventario de URLs. Incluye TODO lo que hoy responde en público, esté o no
  // en el sitemap: el criterio es "una URL que alguien pudo haber compartido",
  // no "una URL que declaramos". Por eso entran también los perfiles inactivos
  // y los posts que el sitemap omite.
  const urls = [
    ...ESTATICAS,
    ...servicios.filter((s) => s.isActive).map((s) => `/servicios/${s.id}`),
    ...perfiles.filter((p) => p.slug).map((p) => `/profesionales/${p.slug}`),
    ...posts.filter((p) => p.status === 'PUBLISHED').map((p) => `/blog/${p.slug}`),
  ].map((ruta) => `${BASE}${ruta}`);

  const rutaInventario = `${DIR}/urls-produccion-${FECHA}.txt`;
  writeFileSync(rutaInventario, urls.join('\n') + '\n', 'utf8');

  console.log(`Respaldo:   ${rutaRespaldo}`);
  console.log(`  Post ${posts.length} · ProfessionalProfile ${perfiles.length} · Service ${servicios.length} · User ${usuarios.length}`);
  console.log(`Inventario: ${rutaInventario} (${urls.length} URLs)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
