// src/app/blog/[slug]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PostMarketingTracker from '@/components/blog/PostMarketingTracker';
import JsonLd from '@/components/JsonLd';
import { siteUrl } from "@/lib/site-url";
import { resolveSeo, buildMetadata } from "@/lib/seo";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";

// Helper para fecha
const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      title: true, excerpt: true, coverImage: true, coverImageTitle: true,
      metaTitle: true, metaDescription: true, ogImage: true, noindex: true,
    },
  });

  if (!post) return { title: 'Artículo no encontrado' };

  const seo = resolveSeo(post, {
    title: post.title,
    description: post.excerpt || post.title,
    image: post.coverImage,
    imageAlt: post.coverImageTitle || post.title,
  });

  return buildMetadata({
    title: seo.title,
    description: seo.description,
    path: `blog/${slug}`,
    image: seo.image,
    imageAlt: seo.imageAlt,
    type: 'article',
    noindex: seo.noindex,
  });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;

  const post = await prisma.post.findFirst({
    where: {
      slug: slug,
      status: 'PUBLISHED'
    },
    include: {
      author: {
        select: {
          id: true, // ID del Perfil (necesario para link agendar)
          specialty: true,
          bio: true,
          // Datos personales desde User
          user: {
            select: {
              name: true,
              image: true
            }
          }
        }
      }
    }
  });

  if (!post) {
    notFound();
  }

  // Helper para acortar el acceso a datos profundos en el JSX
  const authorUser = post.author.user;
  const coverCreditParts = [post.coverImageTitle, post.coverImageAuthor].filter(Boolean);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImage || siteUrl('og-image.png'),
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: siteUrl(`blog/${slug}`),
    author: {
      '@type': 'Person',
      name: authorUser.name,
      image: authorUser.image || undefined,
      jobTitle: post.author.specialty || undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Salud Mental Costa Rica',
      logo: {
        '@type': 'ImageObject',
        url: siteUrl('logo.svg'),
      },
    },
  };

  return (
    <article className="min-h-screen bg-surface">
      <JsonLd data={articleSchema} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Blog", item: siteUrl("blog") }, { "@type": "ListItem", position: 2, name: post.title, item: siteUrl(`blog/${post.slug}`) }] }} />
      {/* Tracker Marketing (Nivel 3) */}
      <PostMarketingTracker slug={slug} title={post.title} />

      {/* Hero / Cabecera */}
      <header className="relative flex h-[400px] w-full items-center justify-center overflow-hidden bg-gray-900">
        {post.coverImage ? (
          <SafeImage
            src={post.coverImage}
            alt={post.coverImageTitle || post.title}
            fallbackSrc=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: `${post.coverImageFocusX ?? 50}% ${post.coverImageFocusY ?? 50}%`,
              transform: `scale(${(post.coverImageScale ?? 100) / 100})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-gray-900 opacity-90" />
        )}
        <div className="image-overlay-strong absolute inset-0" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="mb-4">
            <span className="contrast-on-image rounded-full bg-blue-600 px-3 py-1 text-sm font-bold uppercase tracking-wider">
              Blog
            </span>
          </div>
          <h1 className="contrast-on-image mb-4 text-3xl font-extrabold leading-tight md:text-5xl">
            {post.title}
          </h1>
          <p className="contrast-on-image-muted text-lg">
            {formatDate(post.createdAt)}
          </p>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {(coverCreditParts.length > 0 || post.coverImageNote) && (
          <div className="-mt-6 mb-8 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {coverCreditParts.length > 0 ? (
              <p>
                <span className="font-semibold text-slate-800">{coverCreditParts.join(" - ")}</span>
              </p>
            ) : null}
            {post.coverImageNote ? <p className="mt-1">{post.coverImageNote}</p> : null}
          </div>
        )}

        {/* Tarjeta del Autor */}
        <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-xl border border-gray-100 mb-10">
          <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
            {authorUser.image ? (
              <SafeAvatar src={authorUser.image} name={authorUser.name} className="h-full w-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 font-bold text-xl">
                {authorUser.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 uppercase font-bold tracking-wide">Escrito por</p>
            <h3 className="text-xl font-bold text-gray-900">{authorUser.name}</h3>
            <p className="text-blue-600 font-medium">{post.author.specialty || 'Profesional de Salud'}</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <Link
              href={`/agendar/${post.author.id}`}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Ver Perfil
            </Link>
          </div>
        </div>

        {/* Cuerpo del Artículo */}
        <div
          className="prose prose-lg prose-blue max-w-none text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Footer del Artículo */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/blog" className="text-blue-600 font-bold hover:underline">
            ← Volver a todos los artículos
          </Link>
        </div>

      </div>
    </article>
  );
}
