// src/app/blog/page.js
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { siteUrl } from "@/lib/site-url";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";
import LibraryBar from "@/components/blog/LibraryBar";
import { parseLibraryParams, buildLibraryWhere, buildLibraryOrderBy } from "@/lib/blog-taxonomy";

export const metadata = {
  title: 'Blog de salud mental y bienestar',
  description:
    'Artículos sobre psicología, bienestar, nutrición y salud mental escritos por profesionales verificados en Costa Rica.',
  alternates: { canonical: siteUrl('blog') },
  openGraph: {
    title: 'Blog de salud mental y bienestar | Salud Mental Costa Rica',
    description:
      'Artículos sobre psicología, bienestar, nutrición y salud mental escritos por profesionales verificados.',
    url: siteUrl('blog'),
  },
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const revalidate = 300;

export default async function BlogPage({ searchParams }) {
  const sp = await searchParams;
  const params = parseLibraryParams(sp);

  // Sólo mostramos filtros que tienen contenido publicado detrás (nada de
  // disciplinas o temas vacíos). El vocabulario público exige estado APPROVED.
  // Las consultas van SECUENCIALES a propósito: el pool de la base es de una
  // sola conexión (pooler con connection_limit=1), y un Promise.all de varias
  // consultas se pisa y expira (P2024).
  const publishedApproved = { some: { status: "APPROVED", post: { status: "PUBLISHED" } } };

  const posts = await prisma.post.findMany({
    where: buildLibraryWhere(params),
    orderBy: buildLibraryOrderBy(params),
    take: 24,
    select: {
      id: true, slug: true, title: true,
      coverImage: true, coverImageFocusX: true, coverImageFocusY: true, coverImageScale: true,
      excerpt: true, createdAt: true,
      series: { select: { name: true, slug: true } },
      seriesOrder: true, seriesApproved: true,
      disciplines: { where: { status: "APPROVED" }, select: { discipline: { select: { name: true, slug: true } } } },
      topics: { where: { status: "APPROVED" }, select: { topic: { select: { name: true, slug: true } } } },
      author: { select: { slug: true, specialty: true, user: { select: { name: true, image: true } } } },
    },
  });
  const disciplines = await prisma.discipline.findMany({ where: { isActive: true, posts: publishedApproved }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { name: true, slug: true } });
  const topics = await prisma.topic.findMany({ where: { isActive: true, posts: publishedApproved }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { name: true, slug: true } });
  const series = await prisma.series.findMany({ where: { isActive: true, posts: { some: { status: "PUBLISHED", seriesApproved: true } } }, orderBy: { name: "asc" }, select: { name: true, slug: true } });
  const authors = await prisma.professionalProfile.findMany({ where: { posts: { some: { status: "PUBLISHED" } } }, orderBy: { user: { name: "asc" } }, select: { slug: true, user: { select: { name: true } } } });

  // Temas complementarios del tema seleccionado (curados por el admin, en
  // ambos sentidos de la relación).
  let complementary = [];
  if (params.tema) {
    const current = await prisma.topic.findUnique({
      where: { slug: params.tema },
      select: {
        complementsFrom: { select: { to: { select: { name: true, slug: true } } } },
        complementsTo: { select: { from: { select: { name: true, slug: true } } } },
      },
    });
    if (current) {
      const seen = new Set();
      for (const c of current.complementsFrom) {
        if (!seen.has(c.to.slug)) { seen.add(c.to.slug); complementary.push(c.to); }
      }
      for (const c of current.complementsTo) {
        if (!seen.has(c.from.slug)) { seen.add(c.from.slug); complementary.push(c.from); }
      }
    }
  }

  const authorList = authors.map((a) => ({ slug: a.slug, name: a.user?.name || "Profesional" }));

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-light text-gray-900 tracking-tight">Nuestro Blog</h1>
        <p className="text-lg text-gray-600 mt-3 max-w-2xl mx-auto">
          Artículos, novedades y consejos de nuestros profesionales.
        </p>
      </header>

      <LibraryBar
        params={params}
        vocab={{ disciplines, topics, series }}
        authors={authorList}
        complementary={complementary}
      />

      {posts.length === 0 ? (
        <div className="py-16 text-center bg-gray-50 rounded-2xl border border-gray-100">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            {params.q || params.autor || params.disciplina || params.tema || params.serie
              ? "No hay artículos para esta combinación"
              : "Aún no hay publicaciones"}
          </h3>
          <p className="text-gray-500 mt-1">
            {params.q || params.autor || params.disciplina || params.tema || params.serie ? (
              <Link href="/blog" className="text-brand-700 hover:underline">Quitar los filtros y ver todo</Link>
            ) : (
              "Vuelve pronto para leer nuestro contenido."
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <article key={p.id} className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <Link href={`/blog/${p.slug}`} className="relative h-56 w-full overflow-hidden bg-gray-100 block">
                {p.coverImage ? (
                  <SafeImage
                    src={p.coverImage}
                    alt={`Portada: ${p.title}`}
                    fallbackSrc=""
                    className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    style={{
                      objectPosition: `${p.coverImageFocusX ?? 50}% ${p.coverImageFocusY ?? 50}%`,
                      transform: `scale(${(p.coverImageScale ?? 100) / 100})`,
                    }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                )}
              </Link>

              <div className="p-6 flex flex-col flex-grow">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium mb-3">
                  <time dateTime={p.createdAt.toISOString()} className="bg-blue-50 text-blue-600 px-2 py-1 rounded">
                    {formatDate(p.createdAt)}
                  </time>
                  {p.seriesApproved && p.series ? (
                    <span className="rounded bg-brand-100 px-2 py-1 text-brand-800">
                      {p.series.name}{p.seriesOrder ? ` · ${p.seriesOrder}` : ""}
                    </span>
                  ) : null}
                  {p.disciplines.slice(0, 2).map((d) => (
                    <span key={d.discipline.slug} className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                      {d.discipline.name}
                    </span>
                  ))}
                </div>

                <Link href={`/blog/${p.slug}`} className="block mb-3">
                  <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                    {p.title}
                  </h2>
                </Link>

                {/* Bajada: único lugar donde la itálica de Cormorant suma. */}
                {p.excerpt && <p className="font-display font-light italic text-gray-600 text-base line-clamp-3 mb-4 flex-grow">{p.excerpt}</p>}

                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold uppercase overflow-hidden">
                    {p.author?.user?.image ? (
                      <SafeAvatar src={p.author.user.image} name={p.author.user.name} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span>{p.author?.user?.name ? p.author.user.name.charAt(0) : 'A'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{p.author?.user?.name || 'Redacción'}</span>
                    {p.author?.specialty && <span className="text-xs text-gray-500">{p.author.specialty}</span>}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
