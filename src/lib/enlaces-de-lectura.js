// src/lib/enlaces-de-lectura.js
//
// Las páginas a las que el sitio tiene que empujar enlaces internos (S17).
//
// El 2026-11-10 Search Console tenía /ansiedad, el hub de Raúl y la guía de
// psicoterapia como «descubiertas, sin indexar»: Google las conocía por el
// sitemap pero nada del sitio las enlazaba, así que las veía poco prioritarias.
// La home, el pie de cada artículo y el menú las enlazan desde acá.
//
// Cada entrada se ofrece solo si la página está publicada: un enlace interno a
// un 404 es peor que ninguno.

import { prisma } from "@/lib/prisma";
import { HUB_PATH } from "@/lib/hub-raul";
import { TEMA_DEL_MENU } from "@/lib/tema-del-menu";


const GUIA_PSICOTERAPIA = "que-es-psicoterapia-y-como-orientarse-entre-escuelas";

/**
 * @param {{ excluirPostSlug?: string }} [opciones] para no ofrecerle a un
 *   artículo un enlace a sí mismo.
 * @returns {Promise<Array<{ href: string, titulo: string, bajada: string, clave: string }>>}
 */
export async function enlacesDeLectura({ excluirPostSlug = null } = {}) {
  const [tema, guia] = await Promise.all([
    prisma.topic.findFirst({
      where: { slug: TEMA_DEL_MENU.slug, status: "PUBLISHED", isActive: true },
      select: { slug: true },
    }),
    prisma.post.findFirst({
      where: { slug: GUIA_PSICOTERAPIA, status: "PUBLISHED" },
      select: { slug: true, title: true },
    }),
  ]);

  const enlaces = [];
  if (tema) {
    enlaces.push({
      clave: "tema",
      href: `/${tema.slug}`,
      titulo: "Ansiedad y angustia",
      bajada: "Qué distingue una palabra de la otra, de dónde vienen y cómo se trabaja en consulta.",
    });
  }
  if (guia && guia.slug !== excluirPostSlug) {
    enlaces.push({
      clave: "guia",
      href: `/blog/${guia.slug}`,
      titulo: guia.title,
      bajada: "Qué es y qué no es psicoterapia, y cómo orientarse entre las escuelas.",
    });
  }
  enlaces.push({
    clave: "hub",
    href: `/${HUB_PATH}`,
    titulo: "Consultar con Raúl Olmedo",
    bajada: "Los motivos de consulta que trabaja y cómo es el proceso, en línea desde Costa Rica.",
  });
  return enlaces;
}
