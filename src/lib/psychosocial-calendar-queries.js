// src/lib/psychosocial-calendar-queries.js
//
// Cruce del calendario psicosocial con la biblioteca. Separado del módulo puro
// (psychosocial-calendar.js) para no arrastrar Prisma al bundle del navegador,
// igual que blog-taxonomy-queries.js.
//
// Responde a la pregunta que convierte el recordatorio en decisión de
// producción: "el Día Mundial de la Salud Mental entra en preparación hoy,
// ¿qué tengo ya publicado sobre eso?".

import { prisma } from "@/lib/prisma";

const VACIO = { porTema: {}, temasFaltantes: [] };

/**
 * Cobertura editorial de un conjunto de slugs de tema.
 *
 * Un slug puede no existir todavía: la curaduría de temas es manual y el
 * backfill de taxonomía no inventa temas. Cuando falta, se reporta en
 * `temasFaltantes` para que el panel lo ofrezca como tarea de curaduría en vez
 * de fallar o de mentir con un cero.
 *
 * Consultas secuenciales a propósito: el pool es de una sola conexión
 * (connection_limit=1) y las consultas en paralelo se pisan y expiran (P2024).
 */
export async function coberturaDeTemas(slugs) {
  const unicos = [...new Set((slugs || []).filter(Boolean))];
  if (unicos.length === 0) return VACIO;

  const temas = await prisma.topic.findMany({
    where: { slug: { in: unicos } },
    select: { id: true, slug: true, name: true, isActive: true },
  });

  const temasFaltantes = unicos.filter((slug) => !temas.some((t) => t.slug === slug));
  if (temas.length === 0) return { porTema: {}, temasFaltantes };

  const relaciones = await prisma.postTopic.findMany({
    where: { topicId: { in: temas.map((t) => t.id) }, status: "APPROVED" },
    select: { topicId: true, postId: true, post: { select: { status: true } } },
  });

  // Los carruseles no cuelgan de la taxonomía: se enlazan a un artículo por
  // sourcePostId/blogPostId (plano, sin FK). Se llega a ellos por los posts.
  const postIds = [...new Set(relaciones.map((r) => r.postId))];
  const carruseles = postIds.length
    ? await prisma.carousel.findMany({
        where: {
          OR: [{ sourcePostId: { in: postIds } }, { blogPostId: { in: postIds } }],
        },
        select: { sourcePostId: true, blogPostId: true, status: true },
      })
    : [];

  const porTema = {};
  for (const tema of temas) {
    const suyas = relaciones.filter((r) => r.topicId === tema.id);
    const idsDelTema = new Set(suyas.map((r) => r.postId));
    porTema[tema.slug] = {
      slug: tema.slug,
      nombre: tema.name,
      activo: tema.isActive,
      publicados: suyas.filter((r) => r.post?.status === "PUBLISHED").length,
      borradores: suyas.filter((r) => r.post?.status === "DRAFT").length,
      carruseles: carruseles.filter(
        (c) =>
          (c.sourcePostId && idsDelTema.has(c.sourcePostId)) ||
          (c.blogPostId && idsDelTema.has(c.blogPostId)),
      ).length,
    };
  }

  return { porTema, temasFaltantes };
}

/**
 * Resume la cobertura de una marca concreta: suma sus temas y dice si hay que
 * producir algo. `sinTema` distingue "no declara temas" de "declara temas que
 * no existen en la biblioteca": la segunda es una tarea de curaduría.
 */
export function resumirCobertura(marca, cobertura) {
  const slugs = marca.temas || [];
  if (slugs.length === 0) {
    return { sinTema: true, publicados: 0, borradores: 0, carruseles: 0, faltantes: [] };
  }

  const faltantes = slugs.filter((s) => cobertura.temasFaltantes.includes(s));
  const presentes = slugs.map((s) => cobertura.porTema[s]).filter(Boolean);

  return {
    sinTema: false,
    publicados: presentes.reduce((n, t) => n + t.publicados, 0),
    borradores: presentes.reduce((n, t) => n + t.borradores, 0),
    carruseles: presentes.reduce((n, t) => n + t.carruseles, 0),
    faltantes,
  };
}
