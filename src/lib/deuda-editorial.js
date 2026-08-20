// src/lib/deuda-editorial.js
//
// Qué le falta a cada pieza publicada, leído de la base.
//
// El punto de que esto sea una consulta y no una lista de checkboxes: el trabajo
// pendiente se vuelve visible sin que nadie tenga que acordarse de él, y la lista
// se vacía sola a medida que se carga. Una lista que hay que mantener a mano es
// una lista que queda desactualizada y deja de creerse.

import { prisma } from "@/lib/prisma";

const vacio = (campo) => ({ OR: [{ [campo]: null }, { [campo]: "" }] });

/**
 * Filas de deuda, ordenadas por impacto: primero lo publicado y leído.
 *
 * Cada fila enlaza al editor del elemento, porque una lista de pendientes sin
 * la puerta al lado es una lista que se lee y no se actúa.
 */
export async function deudaEditorial() {
  const [posts, servicios, perfiles] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        metaTitle: true,
        metaDescription: true,
        focusKeyword: true,
        coverImageAlt: true,
        extractiveBlock: true,
        seriesId: true,
      },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, slug: true, title: true, metaTitle: true, metaDescription: true },
    }),
    prisma.professionalProfile.findMany({
      where: { isApproved: true, user: { is: { isActive: true } } },
      select: {
        id: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        licenseVerifiedAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const filas = [];

  for (const p of posts) {
    const falta = [];
    if (!p.metaDescription) falta.push("meta description");
    if (!p.metaTitle) falta.push("meta title");
    if (!p.focusKeyword) falta.push("palabra clave");
    if (!p.excerpt) falta.push("extracto");
    if (!p.coverImageAlt) falta.push("alt de portada");
    if (!p.extractiveBlock) falta.push("bloque extractivo");
    // Un título que dice "Parte" o "Capítulo" y no pertenece a ninguna serie es
    // una serie que existe en la cabeza de quien escribe y no en el sitio.
    if (!p.seriesId && /\b(parte|cap[íi]tulo)\b/i.test(p.title)) falta.push("serie");
    if (falta.length) {
      filas.push({
        tipo: "Artículo",
        nombre: p.title,
        falta,
        editar: `/panel/admin/blog/${p.id}`,
        ver: `/blog/${p.slug}`,
      });
    }
  }

  for (const s of servicios) {
    const falta = [];
    if (!s.metaDescription) falta.push("meta description");
    if (!s.metaTitle) falta.push("meta title");
    if (falta.length) {
      filas.push({
        tipo: "Servicio",
        nombre: s.title,
        falta,
        editar: `/panel/admin/servicios/${s.id}`,
        ver: `/servicios/${s.slug}`,
      });
    }
  }

  for (const pro of perfiles) {
    const falta = [];
    if (!pro.metaDescription) falta.push("meta description");
    if (!pro.metaTitle) falta.push("meta title");
    if (!pro.licenseVerifiedAt) falta.push("colegiatura sin verificar");
    if (falta.length) {
      filas.push({
        tipo: "Perfil",
        nombre: pro.user?.name || pro.slug,
        falta,
        editar: "/panel/admin",
        ver: `/profesionales/${pro.slug}`,
      });
    }
  }

  return filas;
}

/**
 * Estado de los derivados de cada ensayo publicado.
 *
 * Video y transcripción van primero y aparte: son los únicos derivados con
 * capacidad de citación. Slides y reels son distribución. La tabla lo distingue
 * para que la urgencia no se reparta por igual entre cosas que no valen igual.
 */
export async function pipelineEditorial() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      extractiveBlock: true,
      videoUrl: true,
      transcriptUploadedAt: true,
      slidesDoneAt: true,
      reelsDoneAt: true,
    },
  });

  return posts.map((p) => ({
    id: p.id,
    titulo: p.title,
    editar: `/panel/admin/blog/${p.id}`,
    ver: `/blog/${p.slug}`,
    citables: {
      "Bloque extractivo": Boolean(p.extractiveBlock),
      "Video largo": Boolean(p.videoUrl),
      Transcripción: Boolean(p.transcriptUploadedAt),
    },
    distribucion: {
      Slides: Boolean(p.slidesDoneAt),
      Reels: Boolean(p.reelsDoneAt),
    },
  }));
}
