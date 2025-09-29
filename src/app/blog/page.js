// src/app/blog/page.js
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default async function BlogPage() {
  // Traemos solo PUBLISHED y ordenados
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
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
          id: true,
          name: true,
          profession: true,
          avatarUrl: true,
        },
      },
    },
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Blog</h1>

      {posts.length === 0 ? (
        <p className="text-gray-600">Aún no hay publicaciones.</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {posts.map((p) => (
            <li key={p.id} className="border rounded-lg p-4 hover:shadow">
              <Link href={`/blog/${p.slug}`} className="block">
                {p.imageUrl ? (
                  // Usamos <img> para no requerir configuración de dominios en next/image
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-full h-48 object-cover rounded-md mb-3"
                  />
                ) : null}
                <h2 className="text-xl font-semibold">{p.title}</h2>
                <div className="text-sm text-gray-500 mt-1">
                  {p.author?.name ? `${p.author.name}` : 'Autor'}
                  {p.author?.profession ? ` · ${p.author.profession}` : ''}
                  {' · '}
                  {formatDate(new Date(p.createdAt))}
                  {' · '}
                  {p.postType}
                </div>
                {p.service ? (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Servicio:</span>{' '}
                    <Link
                      className="text-blue-600 underline"
                      href={`/servicios/${p.service.slug}`}
                      
                    >
                      {p.service.title}
                    </Link>
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}


