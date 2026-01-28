// src/app/blog/[slug]/page.js
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import MarkdownRenderer from '@/components/MarkdownRenderer'; // Tu componente de renderizado

// --- UTILIDADES ---

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// --- DATA FETCHING ---

/**
 * Obtiene el post actual con sus relaciones necesarias.
 * Nota: En Next.js App Router, las peticiones fetch se dedulican automáticamente.
 * Como estamos usando Prisma directo, si el tráfico es muy alto, podrías envolver
 * esto en `React.cache`, pero para un blog estándar no es estrictamente necesario.
 */
async function getPost(slug) {
  const post = await prisma.post.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      author: {
        select: { name: true, profession: true, avatarUrl: true },
      },
      service: {
        select: { slug: true, title: true },
      },
    },
  });
  return post;
}

/**
 * Calcula el post anterior y siguiente para la navegación al pie de página.
 */
async function getPrevNext(createdAt) {
  const [prev, next] = await Promise.all([
    // Anterior: El más reciente creado ANTES del actual
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', createdAt: { lt: createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { slug: true, title: true },
    }),
    // Siguiente: El más antiguo creado DESPUÉS del actual
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', createdAt: { gt: createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, title: true },
    }),
  ]);
  return { prev, next };
}

// --- METADATOS (SEO) ---

export async function generateMetadata({ params }) {
  // Await params es obligatorio en versiones modernas de Next.js
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Artículo no encontrado' };
  }

  // Creamos un extracto limpio del contenido para la descripción (quitando símbolos de MD)
  const excerpt = post.content
    ? post.content.replace(/[#*`_]/g, '').slice(0, 160) + '...'
    : 'Lee este artículo en nuestro blog.';

  return {
    title: `${post.title} | Blog Profesional`,
    description: excerpt,
    openGraph: {
      title: post.title,
      description: excerpt,
      images: post.imageUrl ? [{ url: post.imageUrl }] : [],
      type: 'article',
      publishedTime: post.createdAt.toISOString(),
      authors: [post.author?.name || 'Autor'],
    },
  };
}

// --- COMPONENTE PRINCIPAL DE PÁGINA ---

export default async function BlogDetailPage({ params }) {
  const { slug } = await params;
  
  if (!slug) notFound();

  const post = await getPost(slug);
  if (!post) notFound();

  const { prev, next } = await getPrevNext(post.createdAt);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      
      {/* 1. Navegación Breadcrumb */}
      <nav className="mb-8 flex items-center text-sm text-gray-500">
        <Link 
          href="/blog" 
          className="hover:text-brand-600 transition-colors flex items-center gap-1 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Volver al blog
        </Link>
      </nav>

      <article className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* 2. Encabezado del Artículo */}
        <header className="mb-10 text-center md:text-left">
          {/* Etiquetas (Categoría / Servicio) */}
          <div className="flex flex-wrap gap-3 mb-6 justify-center md:justify-start">
            <span className="px-3 py-1 bg-brand-50 text-brand-700 text-xs font-bold rounded-full uppercase tracking-wider">
              {post.postType}
            </span>
            {post.service && (
              <Link 
                href={`/servicios/${post.service.slug}`}
                className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full hover:bg-gray-200 transition-colors"
              >
                {post.service.title}
              </Link>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
            {post.title}
          </h1>

          {/* Meta info del autor */}
          <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-600 border-b border-gray-100 pb-8">
            {post.author?.avatarUrl ? (
               <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                 <Image 
                   src={post.author.avatarUrl} 
                   alt={post.author.name} 
                   fill 
                   className="object-cover" 
                 />
               </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                {post.author?.name?.[0] || 'A'}
              </div>
            )}
            
            <div className="flex flex-col text-left">
              <span className="font-semibold text-gray-900 text-base">
                {post.author?.name || 'Redacción'}
              </span>
              <span className="text-gray-500">
                {post.author?.profession ? `${post.author.profession} • ` : ''} 
                <time dateTime={post.createdAt.toISOString()}>
                  {formatDate(post.createdAt)}
                </time>
              </span>
            </div>
          </div>
        </header>

        {/* 3. Hero Section (Imagen o Video Principal) */}
        <div className="mb-12 rounded-2xl overflow-hidden shadow-sm bg-gray-50">
          {post.postType === 'VIDEO' && post.mediaUrl ? (
            <div className="aspect-video w-full">
              <iframe
                src={post.mediaUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={post.title}
              />
            </div>
          ) : post.postType === 'AUDIO' && post.mediaUrl ? (
            <div className="p-8 flex items-center justify-center bg-gray-100">
               <iframe
                src={post.mediaUrl}
                className="w-full h-40 rounded shadow-lg"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                title={post.title}
              />
            </div>
          ) : post.imageUrl ? (
            <div className="relative w-full h-[400px] md:h-[500px]">
              <Image
                src={post.imageUrl}
                alt={`Imagen principal de: ${post.title}`}
                fill
                priority // Carga crítica para LCP
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1000px"
              />
            </div>
          ) : null}
        </div>

        {/* 4. CONTENIDO (Renderizado MDX/Markdown) */}
        <div className="max-w-none">
            {/* Aquí usamos las clases 'prose' que configuramos en tailwind.config.
               prose-lg: Tamaño de letra cómodo.
               prose-brand: (si lo configuraste) o prose-blue por defecto.
            */}
            <article className="prose prose-lg prose-blue mx-auto text-gray-800">
                <MarkdownRenderer content={post.content} />
            </article>
        </div>

      </article>

      {/* 5. Footer de Navegación */}
      <hr className="my-16 border-gray-200" />
      
      <nav className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {prev ? (
          <Link 
            href={`/blog/${prev.slug}`} 
            className="group flex flex-col p-6 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/50 transition-all text-right md:text-left shadow-sm hover:shadow-md"
          >
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Artículo Anterior</span>
            <span className="text-brand-700 font-semibold text-lg group-hover:underline line-clamp-2">
              ← {prev.title}
            </span>
          </Link>
        ) : <div aria-hidden="true" />} 

        {next && (
          <Link 
            href={`/blog/${next.slug}`} 
            className="group flex flex-col p-6 border border-gray-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/50 transition-all text-right shadow-sm hover:shadow-md"
          >
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Siguiente Artículo</span>
            <span className="text-brand-700 font-semibold text-lg group-hover:underline line-clamp-2">
              {next.title} →
            </span>
          </Link>
        )}
      </nav>
    </main>
  );
}