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
      <header className="relative w-full h-[400px] bg-gray-900 flex items-center justify-center overflow-hidden">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover opacity-60"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-gray-900 opacity-90" />
        )}

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="mb-4">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
              Blog
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-gray-300 text-lg">
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
