// src/components/blog/ArticleTaxonomy.js
// Bloques de clasificación al pie del artículo: disciplinas y temas (enlazados
// a la biblioteca filtrada), navegación dentro de la serie, y temas
// complementarios con algunos artículos. Server component; hace sus consultas.

import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getData(post) {
  // Secuencial: el pool de la base es de una sola conexión (connection_limit=1),
  // y varias consultas en paralelo se pisan y expiran (P2024).
  const disciplines = await prisma.postDiscipline.findMany({
    where: { postId: post.id, status: "APPROVED" },
    select: { discipline: { select: { name: true, slug: true } } },
  });
  const topics = await prisma.postTopic.findMany({
    where: { postId: post.id, status: "APPROVED" },
    select: { topic: { select: { id: true, name: true, slug: true } } },
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
  if (topicIds.length) {
    const links = await prisma.topicComplement.findMany({
      where: { OR: [{ fromId: { in: topicIds } }, { toId: { in: topicIds } }] },
      select: {
        from: { select: { id: true, name: true, slug: true } },
        to: { select: { id: true, name: true, slug: true } },
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

  return {
    disciplines: disciplines.map((d) => d.discipline),
    topics: topics.map((t) => t.topic),
    series,
    complementary,
    complementaryPosts,
  };
}

export default async function ArticleTaxonomy({ post }) {
  const { disciplines, topics, series, complementary, complementaryPosts } = await getData(post);

  const hasAnything =
    disciplines.length || topics.length || series || complementary.length;
  if (!hasAnything) return null;

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
                <Link key={t.slug} href={`/blog?tema=${t.slug}`} style={{ backgroundColor: "#fff" }} className="rounded-nv border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand-400">
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
              <Link key={t.slug} href={`/blog?tema=${t.slug}`} style={{ backgroundColor: "#fff" }} className="rounded-nv border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-brand-400">
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
    </section>
  );
}
