// src/app/blog/page.js
import Link from 'next/link';
import Image from 'next/image'; 
import { prisma } from '@/lib/prisma';

const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 20, 
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true, 
      excerpt: true,    
      createdAt: true,
      // Relación con el Autor (ProfessionalProfile)
      author: {
        select: {
          specialty: true, 
          // 1. CORRECCIÓN: Viajamos a User para obtener nombre e imagen
          user: {
            select: {
              name: true,
              image: true 
            }
          }
        },
      },
    },
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Nuestro Blog</h1>
        <p className="text-lg text-gray-600 mt-3 max-w-2xl mx-auto">
          Artículos, novedades y consejos de nuestros profesionales.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="py-16 text-center bg-gray-50 rounded-2xl border border-gray-100">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aún no hay publicaciones</h3>
          <p className="text-gray-500 mt-1">Vuelve pronto para leer nuestro contenido.</p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <article key={p.id} className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
              
              {/* Imagen Clicable */}
              <Link href={`/blog/${p.slug}`} className="relative h-56 w-full overflow-hidden bg-gray-100 block">
                {p.coverImage ? (
                  <Image
                    src={p.coverImage}
                    alt={`Portada: ${p.title}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                )}
              </Link>

              <div className="p-6 flex flex-col flex-grow">
                {/* Metadatos Superiores */}
                <div className="flex items-center gap-2 text-xs font-medium text-blue-600 mb-3">
                   <time dateTime={p.createdAt.toISOString()} className="bg-blue-50 px-2 py-1 rounded">
                    {formatDate(p.createdAt)}
                   </time>
                </div>

                {/* Título */}
                <Link href={`/blog/${p.slug}`} className="block mb-3">
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                    {p.title}
                  </h2>
                </Link>

                {/* Excerpt (Resumen) */}
                {p.excerpt && (
                    <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow">
                        {p.excerpt}
                    </p>
                )}

                {/* Autor */}
                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold uppercase overflow-hidden">
                      {/* 2. CORRECCIÓN JSX: Acceder a image o name en user */}
                      {p.author?.user?.image ? (
                         <img src={p.author.user.image} alt="" className="w-full h-full object-cover"/>
                      ) : (
                         <span>{p.author?.user?.name ? p.author.user.name.charAt(0) : 'A'}</span>
                      )}
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {/* 3. CORRECCIÓN JSX: user.name */}
                        {p.author?.user?.name || 'Redacción'}
                      </span>
                      {p.author?.specialty && (
                        <span className="text-xs text-gray-500">
                          {p.author.specialty}
                        </span>
                      )}
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