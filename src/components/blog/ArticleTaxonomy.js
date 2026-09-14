// src/components/blog/ArticleTaxonomy.js
// Bloques al pie del artículo: navegación dentro de la serie o, si no hay
// serie, el par cronológico de la biblioteca; disciplinas y temas enlazados a
// la biblioteca filtrada; temas complementarios; y lecturas siguientes.
// Server component; hace sus consultas.
//
// La regla que sostiene todo esto está en `lecturas-siguientes.js`: un artículo
// publicado nunca termina en una pared. Antes, un artículo sin clasificar hacía
// que el bloque entero devolviera `null`.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { bloquesDeLectura, completarSugerencias, ofreceLectura } from "@/lib/lecturas-siguientes";

const SELECCION_TARJETA = { id: true, slug: true, title: true, excerpt: true, createdAt: true };

const formatoFecha = (fecha) =>
  new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(fecha));

async function getData(post) {
  // Secuencial: el pool de la base es de una sola conexión (connection_limit=1),
  // y varias consultas en paralelo se pisan y expiran (P2024).
  const disciplines = await prisma.postDiscipline.findMany({
    where: { postId: post.id, status: "APPROVED" },
    select: { discipline: { select: { name: true, slug: true } } },
  });
  const topics = await prisma.postTopic.findMany({
    where: { postId: post.id, status: "APPROVED" },
    select: { topic: { select: { id: true, name: true, slug: true, status: true } } },
  });

  // Navegación de serie (solo si la serie está aprobada para este post).
  let series = null;
  if (post.seriesId && post.seriesApproved) {
    const s = await prisma.series.findUnique({
      where: { id: post.seriesId },
      select: {
        name: true, slug: true,
        posts: {
          where: { status: "PUBLISHED", seriesApproved: true },
          orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, slug: true, title: true, seriesOrder: true },
        },
      },
    });
    if (s) {
      const idx = s.posts.findIndex((p) => p.id === post.id);
      series = {
        name: s.name,
        slug: s.slug,
        total: s.posts.length,
        current: idx >= 0 ? idx + 1 : null,
        prev: idx > 0 ? s.posts[idx - 1] : null,
        next: idx >= 0 && idx < s.posts.length - 1 ? s.posts[idx + 1] : null,
      };
    }
  }

  // Temas complementarios de los temas de este artículo, y algunos artículos.
  const topicIds = topics.map((t) => t.topic.id);
  let complementary = [];
  let complementaryPosts = [];
  let clusterPosts = [];
  if (topicIds.length) {
    clusterPosts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        noindex: false,
        id: { not: post.id },
        topics: { some: { status: "APPROVED", topicId: { in: topicIds } } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, slug: true, title: true, excerpt: true },
    });

    const links = await prisma.topicComplement.findMany({
      where: { OR: [{ fromId: { in: topicIds } }, { toId: { in: topicIds } }] },
      select: {
        from: { select: { id: true, name: true, slug: true, status: true } },
        to: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
    const seen = new Set(topicIds);
    for (const l of links) {
      for (const t of [l.from, l.to]) {
        if (!seen.has(t.id)) { seen.add(t.id); complementary.push(t); }
      }
    }
    if (complementary.length) {
      complementaryPosts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          id: { not: post.id },
          topics: { some: { status: "APPROVED", topicId: { in: complementary.map((t) => t.id) } } },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, slug: true, title: true },
      });
    }
  }

  // Par cronológico de la biblioteca, solo cuando el artículo no está en una
  // serie: el que está en una serie ya tiene anterior y siguiente, y dos pares
  // de flechas con criterios distintos en el mismo pie no orientan, confunden.
  //
  // El filtro es el mismo de `/blog` (solo `status`, sin excluir `noindex`)
  // para que este par y el listado ordenado por fecha describan la misma
  // sucesión. Si acá se excluyera algo que el listado muestra, «el siguiente»
  // sería distinto según desde dónde se mire, que es peor que incluirlo.
  let cronologia = null;
  if (!series && post.createdAt) {
    const anterior = await prisma.post.findFirst({
      where: { status: "PUBLISHED", id: { not: post.id }, createdAt: { lt: post.createdAt } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: SELECCION_TARJETA,
    });
    const siguiente = await prisma.post.findFirst({
      where: { status: "PUBLISHED", id: { not: post.id }, createdAt: { gt: post.createdAt } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: SELECCION_TARJETA,
    });
    if (anterior || siguiente) cronologia = { anterior, siguiente };
  }

  // Sin tema no hay «Lecturas del mismo tema». En vez de no ofrecer nada, se
  // ofrece lo más cercano que exista: otros textos de quien escribe, y los
  // últimos publicados para completar.
  let sugerencias = [];
  if (!clusterPosts.length) {
    // Se excluye lo que el par cronológico ya ofrece: si no, el artículo que
    // figura como «Anterior» vuelve a aparecer dos centímetros más abajo bajo
    // «Seguir leyendo», y el bloque deja de ser una sugerencia para ser un eco.
    const yaOfrecidos = [post.id, cronologia?.anterior?.id, cronologia?.siguiente?.id].filter(Boolean);
    const delAutor = post.authorId
      ? await prisma.post.findMany({
          where: { status: "PUBLISHED", noindex: false, id: { notIn: yaOfrecidos }, authorId: post.authorId },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: SELECCION_TARJETA,
        })
      : [];
    const faltan = 3 - delAutor.length;
    const recientes = faltan > 0
      ? await prisma.post.findMany({
          where: { status: "PUBLISHED", noindex: false, id: { notIn: [...yaOfrecidos, ...delAutor.map((p) => p.id)] } },
          orderBy: { createdAt: "desc" },
          take: faltan,
          select: SELECCION_TARJETA,
        })
      : [];
    sugerencias = completarSugerencias(delAutor, recientes, { limite: 3, excluir: yaOfrecidos });
  }

  return {
    disciplines: disciplines.map((d) => d.discipline),
    topics: topics.map((t) => t.topic),
    series,
    cronologia,
    sugerencias,
    complementary,
    complementaryPosts,
    clusterPosts,
  };
}

export default async function ArticleTaxonomy({ post }) {
  const datos = await getData(post);
  const { disciplines, topics, series, cronologia, sugerencias, complementary, complementaryPosts, clusterPosts } = datos;

  const bloques = bloquesDeLectura(datos);

  // Solo se calla si de verdad no hay nada: un sitio con un único artículo
  // publicado. Mientras exista otro texto al que ir, el pie lo ofrece.
  if (!ofreceLectura(bloques) && !bloques.etiquetas && !bloques.complementarios) return null;

  const topicHref = (topic) => topic.status === "PUBLISHED" ? `/${topic.slug}` : `/blog/tema/${topic.slug}`;

  return (
    <section className="mx-auto mt-4 max-w-3xl space-y-8 px-4 pb-12">
      {/* Serie */}
      {series ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
            Parte {series.current} de {series.total} · Serie
          </p>
          <Link href={`/blog/serie/${series.slug}`} className="mt-1 block text-xl font-semibold text-brand-900 hover:underline">
            {series.name}
          </Link>
          <div className="mt-4 flex flex-wrap gap-3">
            {series.prev ? (
              <Link href={`/blog/${series.prev.slug}`} className="btn btn-outline text-sm">
                ← {series.prev.title}
              </Link>
            ) : null}
            {series.next ? (
              <Link href={`/blog/${series.next.slug}`} className="btn btn-accent text-sm">
                {series.next.title} →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Cronología de la biblioteca, para el artículo que no está en una serie.
          Va arriba, en el mismo lugar que ocuparía la navegación de serie, y
          con la fecha a la vista: sin ella, «anterior» y «siguiente» no dicen
          anterior según qué. */}
      {bloques.cronologia ? (
        <nav aria-label="Artículos anterior y siguiente en la biblioteca" className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">En la biblioteca, por fecha</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {cronologia.anterior ? (
              <Link href={`/blog/${cronologia.anterior.slug}`} className="group rounded-xl border border-slate-200 p-3 transition hover:border-brand-400 hover:shadow-sm">
                <span className="text-xs font-semibold text-slate-500">← Anterior</span>
                <span className="mt-1 block font-semibold text-slate-900 group-hover:text-brand-700">{cronologia.anterior.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{formatoFecha(cronologia.anterior.createdAt)}</span>
              </Link>
            ) : <span aria-hidden="true" className="hidden sm:block" />}
            {cronologia.siguiente ? (
              <Link href={`/blog/${cronologia.siguiente.slug}`} className="group rounded-xl border border-slate-200 p-3 text-right transition hover:border-brand-400 hover:shadow-sm">
                <span className="text-xs font-semibold text-slate-500">Siguiente →</span>
                <span className="mt-1 block font-semibold text-slate-900 group-hover:text-brand-700">{cronologia.siguiente.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{formatoFecha(cronologia.siguiente.createdAt)}</span>
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}

      {/* Disciplinas y temas */}
      {(disciplines.length || topics.length) ? (
        <div className="space-y-3">
          {disciplines.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disciplina</span>
              {disciplines.map((d) => (
                <Link key={d.slug} href={`/blog?disciplina=${d.slug}`} style={{ backgroundColor: "#fff" }} className="rounded-nv border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand-400">
                  {d.name}
                </Link>
              ))}
            </div>
          ) : null}
          {topics.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temas</span>
              {topics.map((t) => (
                <Link key={t.slug} href={topicHref(t)} style={{ backgroundColor: "#fff" }} className="rounded-nv border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand-400">
                  {t.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Temas complementarios */}
      {complementary.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temas complementarios</span>
            {complementary.map((t) => (
              <Link key={t.slug} href={topicHref(t)} style={{ backgroundColor: "#fff" }} className="rounded-nv border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand-400">
                {t.name}
              </Link>
            ))}
          </div>
          {complementaryPosts.length ? (
            <ul className="mt-4 space-y-2">
              {complementaryPosts.map((p) => (
                <li key={p.id}>
                  <Link href={`/blog/${p.slug}`} className="text-brand-700 hover:underline">{p.title}</Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {clusterPosts.length ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Lecturas del mismo tema</p>
          <ul className="mt-3 space-y-3">
            {clusterPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className="font-semibold text-brand-800 hover:underline">{p.title}</Link>
                {p.excerpt ? <p className="mt-1 text-sm text-slate-600">{p.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Última red: el artículo sin tema no tiene de dónde colgar
          recomendaciones, y quedarse sin ofrecer nada era dejar al lector
          contra una pared. Se prefiere a quien escribe antes que lo último
          publicado por cualquiera. */}
      {bloques.sugerencias ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seguir leyendo</p>
          <ul className="mt-3 space-y-3">
            {sugerencias.map((p) => (
              <li key={p.id}>
                <Link href={`/blog/${p.slug}`} className="font-semibold text-brand-800 hover:underline">{p.title}</Link>
                <p className="mt-0.5 text-xs text-slate-500">{formatoFecha(p.createdAt)}</p>
                {p.excerpt ? <p className="mt-1 text-sm text-slate-600">{p.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
