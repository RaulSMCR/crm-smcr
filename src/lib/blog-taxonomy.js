// src/lib/blog-taxonomy.js
//
// Helpers compartidos por la biblioteca pública del blog, el editor y el panel
// de taxonomía. Regla central: la cara pública SOLO ve etiquetas APPROVED y
// series con seriesApproved. El profesional propone (SUGGESTED); el admin
// aprueba.

import { slugify } from "@/lib/carousel-spec";

export { slugify };

// Modos de orden de la biblioteca. "recientes" y "leidos" no necesitan
// curaduría: salen de createdAt y de PostViewEvent.
export const LIBRARY_SORTS = {
  recientes: "Más recientes",
  antiguos: "Más antiguos",
  leidos: "Más leídos",
};

export const DEFAULT_SORT = "recientes";

// Normaliza los searchParams de /blog a un objeto estable.
export function parseLibraryParams(sp = {}) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const sort = str(sp.orden);
  return {
    q: str(sp.q),
    autor: str(sp.autor),
    disciplina: str(sp.disciplina),
    tema: str(sp.tema),
    serie: str(sp.serie),
    sort: sort && LIBRARY_SORTS[sort] ? sort : DEFAULT_SORT,
  };
}

// Construye el `where` de Prisma para la biblioteca pública a partir de los
// filtros. Todos los filtros de taxonomía exigen estado APPROVED.
export function buildLibraryWhere(params) {
  const where = { status: "PUBLISHED" };

  if (params.autor) where.author = { slug: params.autor };
  if (params.serie) where.series = { slug: params.serie };
  if (params.serie) where.seriesApproved = true;

  if (params.disciplina) {
    where.disciplines = { some: { status: "APPROVED", discipline: { slug: params.disciplina } } };
  }
  if (params.tema) {
    where.topics = { some: { status: "APPROVED", topic: { slug: params.tema } } };
  }
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { excerpt: { contains: params.q, mode: "insensitive" } },
      { content: { contains: params.q, mode: "insensitive" } },
    ];
  }

  return where;
}

// El orden "más leídos" se resuelve por conteo de PostViewEvent, que Prisma
// permite ordenar con _count sobre la relación.
export function buildLibraryOrderBy(params) {
  if (params.sort === "leidos") return [{ viewEvents: { _count: "desc" } }, { createdAt: "desc" }];
  if (params.sort === "antiguos") return [{ createdAt: "asc" }];
  return [{ createdAt: "desc" }];
}

// Construye un querystring preservando los filtros activos y cambiando uno.
// Útil para los enlaces de la barra de la biblioteca.
export function libraryHref(params, patch = {}) {
  const merged = { ...params, ...patch };
  const usp = new URLSearchParams();
  if (merged.q) usp.set("q", merged.q);
  if (merged.autor) usp.set("autor", merged.autor);
  if (merged.disciplina) usp.set("disciplina", merged.disciplina);
  if (merged.tema) usp.set("tema", merged.tema);
  if (merged.serie) usp.set("serie", merged.serie);
  if (merged.sort && merged.sort !== DEFAULT_SORT) usp.set("orden", merged.sort);
  const qs = usp.toString();
  return qs ? `/blog?${qs}` : "/blog";
}
