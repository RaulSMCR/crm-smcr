// src/lib/blog-taxonomy-queries.js
//
// Consultas server-side de taxonomía. Separado de blog-taxonomy.js (que es puro
// y se importa también desde componentes cliente) para no arrastrar Prisma al
// bundle del navegador.

import { prisma } from "@/lib/prisma";

// Vocabulario activo para los selectores del editor y del panel.
// Secuencial: el pool de la base es de una sola conexión (connection_limit=1) y
// las consultas en paralelo se pisan y expiran (P2024).
export async function listActiveVocab() {
  const disciplines = await prisma.discipline.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  const topics = await prisma.topic.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  const series = await prisma.series.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return { disciplines, topics, series };
}

// Taxonomía actual de un artículo, para precargar el editor. Devuelve los ids
// con su estado (SUGGESTED/APPROVED) para que el admin distinga lo pendiente.
export async function getPostTaxonomy(postId) {
  const post = await prisma.post.findUnique({
    where: { id: String(postId) },
    select: {
      seriesId: true,
      seriesOrder: true,
      seriesApproved: true,
      disciplines: { select: { disciplineId: true, status: true } },
      topics: { select: { topicId: true, status: true } },
    },
  });
  if (!post) return null;
  return {
    seriesId: post.seriesId,
    seriesOrder: post.seriesOrder,
    seriesApproved: post.seriesApproved,
    disciplines: post.disciplines.map((d) => ({ id: d.disciplineId, status: d.status })),
    topics: post.topics.map((t) => ({ id: t.topicId, status: t.status })),
  };
}
