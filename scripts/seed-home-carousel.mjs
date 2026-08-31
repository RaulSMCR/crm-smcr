// scripts/seed-home-carousel.mjs
//
// Repuebla `HomeCarouselItem`, la tabla que alimenta el carrusel de la home
// (`src/components/HomeFeatureCarousel.js`). Existe porque el vaciado de la
// base del 2026-08-19 se llevó esas filas: el respaldo que salvó la situación
// —docs/backups/pre-seo-2026-08-19.json— solo contenía Post,
// ProfessionalProfile, Service y User. Sin filas activas el componente hace
// `return null` y la seccion desaparece de la home sin ningun aviso.
//
// Es idempotente: identifica cada pieza por su `kind` y no crea una segunda si
// ya existe una activa de ese tipo. Correrlo dos veces no duplica nada.
//
// La curaduria de aca es un punto de partida razonable, no una decision
// editorial cerrada: el admin la edita desde /panel/admin/marketing, seccion
// "Promocion interna en home".
//
// Uso:
//   node -r dotenv/config scripts/seed-home-carousel.mjs            dry-run
//   node -r dotenv/config scripts/seed-home-carousel.mjs --commit   escribe

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const COMMIT = process.argv.includes("--commit");

// Seleccion por slug, no por "el mas reciente": que la pieza destacada cambie
// sola cada vez que alguien publica es justo lo que un destacado no debe hacer.
// ARTICLE_NEW si mira la fecha, porque ahi el criterio es la novedad.
const CURADURIA = [
  {
    kind: "ARTICLE_NEW",
    label: "Lo ultimo del blog",
    displayOrder: 1,
    // null = el articulo publicado mas reciente, resuelto en tiempo de corrida.
    postSlug: null,
  },
  {
    kind: "PROFESSIONAL_NEW",
    label: "Se suma al equipo",
    displayOrder: 2,
    // Nutricion: la incorporacion mas reciente y la que ensancha el equipo mas
    // alla de la psicologia clinica, que es lo que la home no muestra.
    professionalSlug: "halina-sobrado",
  },
  {
    kind: "ARTICLE_FEATURED",
    label: "Para empezar a leer",
    displayOrder: 3,
    // El texto de orientacion: es el que sirve a alguien que llega sin saber
    // que es una psicoterapia ni como elegir entre escuelas.
    postSlug: "que-es-psicoterapia-y-como-orientarse-entre-escuelas",
  },
  {
    kind: "PROFESSIONAL_FEATURED",
    label: "Conoce al equipo",
    displayOrder: 4,
    professionalSlug: "andrea-robles",
  },
];

async function resolverPost(slug) {
  if (slug) {
    return prisma.post.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: { id: true, slug: true, title: true },
    });
  }
  return prisma.post.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true },
  });
}

async function resolverProfesional(slug) {
  return prisma.professionalProfile.findFirst({
    where: { slug, isApproved: true, user: { is: { isActive: true } } },
    select: { id: true, slug: true, user: { select: { name: true } } },
  });
}

async function main() {
  console.log(COMMIT ? "== MODO ESCRITURA ==" : "== DRY-RUN (agregar --commit para escribir) ==");

  const yaExisten = await prisma.homeCarouselItem.findMany({
    where: { isActive: true },
    select: { id: true, kind: true },
  });
  const ocupados = new Set(yaExisten.map((x) => x.kind));
  if (ocupados.size) console.log("Tipos ya activos, se respetan:", [...ocupados].join(", "));

  let creados = 0;
  let omitidos = 0;

  for (const pieza of CURADURIA) {
    if (ocupados.has(pieza.kind)) {
      console.log(`  omitido  ${pieza.kind}: ya hay una pieza activa`);
      omitidos += 1;
      continue;
    }

    const esArticulo = pieza.kind.startsWith("ARTICLE");
    const destino = esArticulo
      ? await resolverPost(pieza.postSlug)
      : await resolverProfesional(pieza.professionalSlug);

    if (!destino) {
      const buscado = esArticulo ? pieza.postSlug || "(el mas reciente)" : pieza.professionalSlug;
      console.log(`  FALLA    ${pieza.kind}: no existe o no esta publicado/aprobado -> ${buscado}`);
      omitidos += 1;
      continue;
    }

    const nombre = esArticulo ? destino.title : destino.user?.name;
    console.log(`  crea     ${pieza.kind} -> ${destino.slug} (${nombre})`);

    if (COMMIT) {
      await prisma.homeCarouselItem.create({
        data: {
          kind: pieza.kind,
          label: pieza.label,
          displayOrder: pieza.displayOrder,
          isActive: true,
          postId: esArticulo ? destino.id : null,
          professionalId: esArticulo ? null : destino.id,
        },
      });
    }
    creados += 1;
  }

  console.log(`\n${COMMIT ? "Creados" : "Se crearian"}: ${creados} | omitidos: ${omitidos}`);
  const total = await prisma.homeCarouselItem.count({ where: { isActive: true } });
  console.log(`Piezas activas en la tabla ahora: ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
