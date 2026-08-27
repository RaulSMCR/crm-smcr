// src/app/blog/tema/[slug]/page.js
//
// Página de archivo de un tema.
//
// Existe porque la biblioteca ya filtraba por tema, pero con querystring
// (`/blog?tema=psicoanalisis`), y una vista filtrada por parámetro no es una
// página que un buscador indexe por derecho propio. El tema es transversal: un
// mismo artículo puede pertenecer a una serie y a varios temas, y es esa
// transversalidad la que hace de esta página algo distinto del listado de serie
// —si un tema agrupara exactamente los posts de una serie, serían dos URLs con
// el mismo contenido compitiendo entre sí—.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";
import SafeImage from "@/components/SafeImage";
import JsonLd from "@/components/JsonLd";
import { buildMetadata } from "@/lib/seo";
import { grafo, nodoListado, nodoMigas, idArticulo } from "@/lib/jsonld";

export const revalidate = 300;

const formatDate = (date) =>
  new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", year: "numeric" }).format(date);

/**
 * El tema con sus artículos publicados.
 *
 * El filtro `status: "APPROVED"` es el mismo de la biblioteca: una etiqueta
 * sugerida y todavía no revisada no debe aparecer en una página pública.
 */
async function getTema(slug) {
  return prisma.topic.findFirst({
    where: { slug: String(slug || ""), isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      posts: {
        where: { status: "APPROVED", post: { status: "PUBLISHED", noindex: false } },
        select: {
          post: {
            select: {
              id: true, slug: true, title: true, excerpt: true, createdAt: true,
              coverImage: true, coverImageFocusX: true, coverImageFocusY: true,
              series: { select: { name: true, slug: true } },
              author: { select: { specialty: true, user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tema = await getTema(slug);
  if (!tema) return { title: "Tema no encontrado" };

  return buildMetadata({
    title: `${tema.name} · Artículos`,
    description: `Ensayos sobre ${tema.name.toLowerCase()} escritos por profesionales colegiados en Costa Rica. ${tema.posts.length} ${tema.posts.length === 1 ? "artículo" : "artículos"} en la biblioteca.`,
    path: `blog/tema/${slug}`,
    subtitle: "Tema",
  });
}

export default async function TemaPage({ params }) {
  const { slug } = await params;
  const tema = await getTema(slug);
  if (!tema) notFound();

  // Un tema sin artículos aprobados no es una página: es una etiqueta vacía.
  // Se trata como inexistente en vez de servir un archivo en blanco.
  const posts = tema.posts.map((t) => t.post).filter(Boolean);
  if (posts.length === 0) notFound();

  posts.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <JsonLd
        data={grafo(
          nodoListado({
            id: `${siteUrl(`blog/tema/${tema.slug}`)}#tema`,
            nombre: tema.name,
            items: posts.map((post) => ({
              url: siteUrl(`blog/${post.slug}`),
              nombre: post.title,
              id: idArticulo(post.slug),
            })),
          }),
          nodoMigas([
            { nombre: "Biblioteca", url: siteUrl("blog") },
            { nombre: tema.name, url: siteUrl(`blog/tema/${tema.slug}`) },
          ]),
        )}
      />

      <div className="mb-8">
        <Link href="/blog" className="text-sm font-semibold text-brand-700 hover:underline">
          ← Biblioteca
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Tema</p>
        <h1 className="mt-1 text-4xl font-light text-gray-900">{tema.name}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {posts.length} {posts.length === 1 ? "artículo" : "artículos"}
        </p>
      </div>

      <ol className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.slug}`}
              className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-lg"
            >
              {post.coverImage ? (
                <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
                  <SafeImage
                    src={post.coverImage}
                    alt=""
                    fallbackSrc=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: `${post.coverImageFocusX ?? 50}% ${post.coverImageFocusY ?? 50}%`,
                    }}
                  />
                </div>
              ) : null}

              <div className="min-w-0">
                <h2 className="font-semibold text-gray-900 group-hover:text-brand-700">{post.title}</h2>
                {post.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>
                ) : null}
                <p className="mt-2 text-xs text-gray-500">
                  {post.author?.user?.name ? `${post.author.user.name} · ` : ""}
                  {formatDate(post.createdAt)}
                  {/* La serie se nombra acá porque es la otra entrada al mismo
                      artículo: quien llega por el tema puede querer leerlo en
                      orden. */}
                  {post.series ? ` · Serie: ${post.series.name}` : ""}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
