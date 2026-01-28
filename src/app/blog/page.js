// src/app/blog/page.js
import Link from 'next/link';
import Image from 'next/image'; // Usaremos el componente optimizado
import { prisma } from '@/lib/prisma';

// Utilidad para formatear fechas (extraída para reutilización o testeo)
const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export default async function BlogPage() {
  // ADVERTENCIA: En producción, debes implementar paginación (skip/take).
  // Aquí limitamos a 20 para evitar sobrecarga si la BD crece.
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 20, 
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      createdAt: true,
      postType: true,
      service: { select: { id: true, slug: true, title: true } },
      author: {
        select: {
          name: true,
          profession: true,
          // avatarUrl: true, // No lo usabas en el renderizado, lo quité para optimizar la query
        },
      },
    },
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Blog</h1>
        <p className="text-gray-500 mt-2">Explora nuestros últimos artículos y novedades.</p>
      </header>

      {posts.length === 0 ? (
        <div className="py-10 text-center text-gray-500 bg-gray-50 rounded-lg">
          <p>Aún no hay publicaciones disponibles.</p>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li key={p.id} className="group flex flex-col border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white">
              {/* SOLUCIÓN ENLACES ANIDADOS: 
                 En lugar de envolver todo, envolvemos la imagen y el título por separado,
                 o usamos un enlace absoluto posicionado (no implementado aquí para mantener la semántica simple).
              */}
              
              {/* Imagen Clicable */}
              {p.imageUrl && (
                <Link href={`/blog/${p.slug}`} className="relative h-48 w-full overflow-hidden bg-gray-100">
                  {/* Si decides no usar next/image, vuelve a <img>, pero te recomiendo configurar el dominio */}
                  <Image
                    src={p.imageUrl}
                    alt={`Portada del artículo: ${p.title}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </Link>
              )}

              <div className="p-4 flex flex-col flex-grow">
                {/* Título Clicable */}
                <Link href={`/blog/${p.slug}`} className="block">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {p.title}
                  </h2>
                </Link>

                <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-x-2 items-center">
                  <span>{p.author?.name || 'Redacción'}</span>
                  {p.author?.profession && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>{p.author.profession}</span>
                    </>
                  )}
                  <span className="text-gray-300">•</span>
                  <time dateTime={p.createdAt.toISOString()}>
                    {formatDate(p.createdAt)}
                  </time>
                </div>

                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-600">
                    {p.postType}
                  </span>

                  {/* Enlace al Servicio independiente (ahora es válido porque no está dentro de otro Link) */}
                  {p.service && (
                    <Link
                      href={`/servicios/${p.service.slug}`}
                      className="text-sm text-blue-600 hover:underline font-medium"
                    >
                      {p.service.title} →
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}