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
// Uso:
//   node scripts/backfill-blog-taxonomy.mjs            dry-run (por defecto)
//   node scripts/backfill-blog-taxonomy.mjs --commit   escribe
//
// AVISO. Este archivo referencia artículos por slug literal, así que S4 —que
// reparó los slugs mutilados— lo dejó apuntando al vacío: siete de sus ocho
// slugs dejaron de existir. Se corrigió, pero la fragilidad sigue ahí: si algún
// slug vuelve a cambiar, hay que actualizar esta lista. El dry-run existe para
// que eso se note antes de escribir, y no después.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// La implementación unificada de S3. Antes había una copia local acá, que es
// exactamente cómo nacieron las siete versiones distintas que S3 vino a juntar.
import { slugify } from "../src/lib/slug.js";

const titleCase = (s) =>
  String(s || "").trim().replace(/\s+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Series existentes, por slug de artículo → orden.
const SERIES = [
  {
    name: "Genealogía del concepto de salud mental",
    description:
      "Cómo llegamos a llamar «salud mental» a lo que antes se llamó de otras maneras: un itinerario por sus desplazamientos históricos.",
    posts: [
      "capitulo-1-del-cuidado-de-si-al-cuidado-pastoral-el-alma-antes-de-la-clinica",
      "mundo-encerro-locura-nacimiento-clinica",
      "siglo-xx-palabra-pastilla-codigo",
      "oms-consagracion-global-salud-mental-alma-ata",
    ],
  },
  {
    name: "¿Qué es psicoterapia y cómo orientarse entre escuelas?",
    description: "Una guía en cuatro entregas para entender la psicoterapia y sus corrientes.",
    posts: [
      "que-es-psicoterapia-y-como-orientarse-entre-escuelas",
      "que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-2",
      "que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-3",
      "que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-4",
    ],
  },
  {
    name: "Del alma atribulada a la salud mental",
    description: "Dos entregas sobre el pasaje del alma que sufre al sujeto que se atiende.",
    posts: [
      "serie-del-alma-atribulada-a-la-salud-mental",
      "la-salud-mental-despues-de-las-luces",
    ],
  },
  {
    name: "Autoayuda pop y psicólogo influencer",
    description: "Qué pasa cuando el conocimiento psicológico se vuelve producto de consumo.",
    posts: [
      "autoayuda-pop-y-psicologo-influencer-parte-i",
      "autoayuda-pop-y-psicologo-influencer-parte-ii",
    ],
  },
  {
    name: "La salud mental no cabe en una sola disciplina",
    description:
      "Por qué el trabajo interdisciplinario no es acumular profesionales sino articular saberes.",
    posts: [
      "la-salud-mental-no-cabe-en-una-sola-disciplina",
      "la-salud-mental-no-cabe-en-una-sola-disciplina-ii",
    ],
  },
];

const COMMIT = process.argv.includes("--commit");


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
    if (COMMIT) {
      await prisma.postDiscipline.upsert({
        where: { postId_disciplineId: { postId: post.id, disciplineId } },
        create: { postId: post.id, disciplineId, status: "APPROVED" },
        update: { status: "APPROVED" },
      });
    }
    disciplineLinks++;
  }
  console.log(`Disciplinas: ${disciplineCache.size} sembradas, ${disciplineLinks} artículos clasificados.`);

  // 3. Series.
  let seriesCount = 0;
  let seriesLinks = 0;
  for (const def of SERIES) {
    const slug = slugify(def.name);
    const series = COMMIT
      ? await prisma.series.upsert({
          where: { slug },
          create: { name: def.name, slug, description: def.description },
          update: { description: def.description },
        })
      : { id: "(dry-run)" };
    seriesCount++;
    console.log(`
${def.name}`);
    for (let i = 0; i < def.posts.length; i++) {
      const postSlug = def.posts[i];
      const post = await prisma.post.findUnique({ where: { slug: postSlug }, select: { id: true } });
      if (!post) {
        // Este aviso es el que importa: significa que un slug de esta lista dejó
        // de existir, y el artículo se quedaría fuera de su serie en silencio.
        console.warn(`    ! NO EXISTE  ${postSlug}`);
        continue;
      }
      console.log(`    ${i + 1}. ${postSlug}`);
      if (COMMIT) {
        await prisma.post.update({
          where: { id: post.id },
          data: { seriesId: series.id, seriesOrder: i + 1, seriesApproved: true },
        });
      }
      seriesLinks++;
    }
  }
  console.log(`
Series: ${seriesCount} · artículos ordenados: ${seriesLinks}`);

  const huerfanos = await prisma.post.findMany({
    where: { status: "PUBLISHED", seriesId: null },
    select: { slug: true, title: true },
  });
  const enAlgunaSerie = new Set(SERIES.flatMap((d) => d.posts));
  const sueltos = huerfanos.filter((p) => !enAlgunaSerie.has(p.slug));
  if (sueltos.length) {
    console.log(`
Artículos que no pertenecen a ninguna serie (${sueltos.length}):`);
    for (const p of sueltos) console.log(`  ${p.title}`);
  }

  if (!COMMIT) {
    console.log("\nDry-run: no se escribió nada. Para aplicar: --commit");
  }
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Backfill falló:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
