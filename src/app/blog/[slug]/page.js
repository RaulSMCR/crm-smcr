// src/app/blog/[slug]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import PostMarketingTracker from '@/components/blog/PostMarketingTracker';

// Helper para fecha
const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

// Generar Metadatos SEO
export async function generateMetadata({ params }) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    select: { title: true, excerpt: true }
  });

  if (!post) return { title: 'Artículo no encontrado' };

  return {
    title: `${post.title} | Blog Salud Mental`,
    description: post.excerpt || post.title,
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = params;

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

  return (
    <article className="min-h-screen bg-white">
      {/* Tracker Marketing (Nivel 3) */}
      <PostMarketingTracker slug={slug} />

      {/* Hero / Cabecera */}
      <header className="relative flex h-[400px] w-full items-center justify-center overflow-hidden bg-gray-900">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
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

        {/* Tarjeta del Autor */}
        <div className="flex items-center gap-4 p-6 bg-gray-50 rounded-xl border border-gray-100 mb-10">
          <div className="w-16 h-16 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
            {authorUser.image ? (
              <img src={authorUser.image} alt={authorUser.name} className="w-full h-full object-cover" />
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
