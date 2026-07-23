// scripts/backfill-blog-taxonomy.mjs
//
// Backfill único de la taxonomía de la biblioteca. Es idempotente: se puede
// correr más de una vez sin duplicar.
//
// Hace tres cosas:
//   1. Siembra disciplinas a partir de las especialidades reales de los
//      profesionales (punto de partida; el admin las edita/fusiona después).
//   2. Asigna a cada artículo la disciplina de su autor, ya APROBADA, para que
//      la biblioteca no arranque vacía en "por disciplina".
//   3. Crea las dos series existentes (que hoy solo viven en el título) y les
//      asigna orden, con seriesApproved = true.
//
// NO inventa temas: eso queda para la curaduría editorial.
//
// IMPORTANTE: correr DESPUÉS de que la migración 20260723160000_blog_taxonomy
// esté aplicada (Vercel la corre con `prisma migrate deploy` en el deploy).
// Antes de eso las tablas no existen y el script falla.
//
// Uso: node scripts/backfill-blog-taxonomy.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const slugify = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const titleCase = (s) =>
  String(s || "").trim().replace(/\s+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Series existentes, por slug de artículo → orden.
const SERIES = [
  {
    name: "Genealogía del concepto de salud mental",
    description: "Un itinerario por la historia y las tensiones del concepto de salud mental.",
    posts: [
      "del-alma-atribulada-a-la-salud-mental-un-itinerario-geneal-gico-introducci-n",
      "parte-i-genealog-a-del-concepto-de-salud-mental",
      "parte-ii-salud-menta-definiciones-disciplinarias-en-tensi-n",
      "parte-iii-l-neas-abiertas-y-horizontes-contempor-neos-de-la-salud-mental",
    ],
  },
  {
    name: "¿Qué es psicoterapia y cómo orientarse entre escuelas?",
    description: "Una guía en cuatro entregas para entender la psicoterapia y sus corrientes.",
    posts: [
      "que-es-psicoterapia-y-como-orientarse-entre-escuelas",
      "qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-2",
      "qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-3",
      "qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-4",
    ],
  },
];

async function upsertDisciplineByName(name) {
  const clean = titleCase(name);
  const slug = slugify(clean);
  if (!slug) return null;
  const existing = await prisma.discipline.findFirst({
    where: { OR: [{ slug }, { name: clean }] },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.discipline.create({ data: { name: clean, slug } });
  return created.id;
}

async function run() {
  // 1 + 2. Disciplinas desde especialidades, y asignación por autor.
  const posts = await prisma.post.findMany({
    select: { id: true, slug: true, author: { select: { specialty: true } } },
  });

  const disciplineCache = new Map();
  let disciplineLinks = 0;
  for (const post of posts) {
    const specialty = post.author?.specialty?.trim();
    if (!specialty) continue;
    const key = slugify(specialty);
    if (!disciplineCache.has(key)) disciplineCache.set(key, await upsertDisciplineByName(specialty));
    const disciplineId = disciplineCache.get(key);
    if (!disciplineId) continue;
    await prisma.postDiscipline.upsert({
      where: { postId_disciplineId: { postId: post.id, disciplineId } },
      create: { postId: post.id, disciplineId, status: "APPROVED" },
      update: { status: "APPROVED" },
    });
    disciplineLinks++;
  }
  console.log(`Disciplinas: ${disciplineCache.size} sembradas, ${disciplineLinks} artículos clasificados.`);

  // 3. Series.
  let seriesCount = 0;
  let seriesLinks = 0;
  for (const def of SERIES) {
    const slug = slugify(def.name);
    const series = await prisma.series.upsert({
      where: { slug },
      create: { name: def.name, slug, description: def.description },
      update: { description: def.description },
    });
    seriesCount++;
    for (let i = 0; i < def.posts.length; i++) {
      const postSlug = def.posts[i];
      const post = await prisma.post.findUnique({ where: { slug: postSlug }, select: { id: true } });
      if (!post) {
        console.warn(`  ⚠ no encontré el artículo ${postSlug}`);
        continue;
      }
      await prisma.post.update({
        where: { id: post.id },
        data: { seriesId: series.id, seriesOrder: i + 1, seriesApproved: true },
      });
      seriesLinks++;
    }
  }
  console.log(`Series: ${seriesCount} creadas/actualizadas, ${seriesLinks} artículos ordenados.`);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Backfill falló:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
