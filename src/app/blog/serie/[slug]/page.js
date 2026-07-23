// src/app/blog/serie/[slug]/page.js
// Página de una serie: los artículos de un mismo tema en orden.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import SafeImage from "@/components/SafeImage";

export const revalidate = 300;

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);

async function getSeries(slug) {
  return prisma.series.findFirst({
    where: { slug: String(slug || ""), isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      posts: {
        where: { status: "PUBLISHED", seriesApproved: true },
        orderBy: [{ seriesOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, slug: true, title: true, excerpt: true, createdAt: true, seriesOrder: true,
          coverImage: true, coverImageFocusX: true, coverImageFocusY: true, coverImageScale: true,
          author: { select: { specialty: true, user: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const series = await prisma.series.findUnique({ where: { slug: String(slug || "") }, select: { name: true, description: true } });
  if (!series) return { title: "Serie no encontrada" };
  return {
    title: `${series.name} · Serie`,
    description: series.description || `Serie de artículos: ${series.name}.`,
    alternates: { canonical: siteUrl(`blog/serie/${slug}`) },
  };
}

export default async function SeriesPage({ params }) {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) notFound();

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/blog" className="text-sm font-semibold text-brand-700 hover:underline">← Biblioteca</Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Serie</p>
        <h1 className="mt-1 text-4xl font-light text-gray-900">{series.name}</h1>
        {series.description ? (
          <p className="mt-3 font-display font-light italic text-lg text-gray-600 max-w-2xl">{series.description}</p>
        ) : null}
        <p className="mt-2 text-sm text-gray-500">{series.posts.length} {series.posts.length === 1 ? "entrega" : "entregas"}</p>
      </div>

      {series.posts.length === 0 ? (
        <p className="text-gray-500">Todavía no hay entregas publicadas en esta serie.</p>
      ) : (
        <ol className="space-y-4">
          {series.posts.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/blog/${p.slug}`}
                className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-lg"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-nv bg-brand-600 text-lg font-semibold text-white">
                  {p.seriesOrder ?? i + 1}
                </div>
                {p.coverImage ? (
                  <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
                    <SafeImage
                      src={p.coverImage}
                      alt=""
                      fallbackSrc=""
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: `${p.coverImageFocusX ?? 50}% ${p.coverImageFocusY ?? 50}%` }}
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-brand-700 line-clamp-2">{p.title}</h2>
                  {p.excerpt ? <p className="mt-1 text-sm text-gray-600 line-clamp-2">{p.excerpt}</p> : null}
                  <p className="mt-1 text-xs text-gray-500">
                    {p.author?.user?.name || "Redacción"} · {formatDate(p.createdAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
