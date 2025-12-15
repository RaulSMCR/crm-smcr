// src/app/blog/[slug]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

function formatDate(date) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

async function getPost(slug) {
  const post = await prisma.post.findFirst({
    where: { slug, status: 'PUBLISHED' }, // mostramos solo publicados
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      imageUrl: true,
      mediaUrl: true,
      postType: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          profession: true,
          avatarUrl: true,
        },
      },
      service: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
  });
  return post;
}

async function getPrevNext(createdAt) {
  // prev: más reciente anterior; next: más antiguo siguiente
  const [prev, next] = await Promise.all([
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', createdAt: { lt: createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { slug: true, title: true },
    }),
    prisma.post.findFirst({
      where: { status: 'PUBLISHED', createdAt: { gt: createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, title: true },
    }),
  ]);
  return { prev, next };
}

export default async function BlogDetailPage({ params }) {
  const slug = params?.slug;
  if (!slug) notFound();

  const post = await getPost(slug);
  if (!post) notFound();

  const { prev, next } = await getPrevNext(post.createdAt);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/blog" className="text-sm text-blue-600 underline">
          ← Volver al blog
        </Link>
      </div>

      <article>
        <h1 className="text-3xl font-bold mb-2">{post.title}</h1>

        <div className="text-sm text-brand-300 mb-4">
          {post.author?.name ? `${post.author.name}` : 'Autor'}
          {post.author?.profession ? ` · ${post.author.profession}` : ''}
          {' · '}
          {formatDate(new Date(post.createdAt))}
          {' · '}
          {post.postType}
          {post.service ? (
            <>
              {' · Servicio: '}
              <Link className="text-blue-600 underline" href={`/servicios/${post.service.slug}`}>
                {post.service.title}
              </Link>
            </>
          ) : null}
        </div>

        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-64 object-cover rounded-md mb-6"
          />
        ) : null}

        {/* Media embebida si aplica */}
        {post.postType === 'VIDEO' && post.mediaUrl ? (
          <div className="aspect-video w-full mb-6">
            <iframe
              src={post.mediaUrl}
              className="w-full h-full rounded-md"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={post.title}
            />
          </div>
        ) : null}

        {post.postType === 'AUDIO' && post.mediaUrl ? (
          <div className="mb-6">
            <iframe
              src={post.mediaUrl}
              className="w-full h-28 rounded-md"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
              title={post.title}
            />
          </div>
        ) : null}

        <div className="prose max-w-none">
          <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>
        </div>
      </article>

      {/* Navegación anterior / siguiente */}
      <nav className="flex justify-between items-center mt-10 pt-6 border-t">
        <div>
          {prev ? (
            <Link href={`/blog/${prev.slug}`} className="text-blue-600 underline">
              ← {prev.title}
            </Link>
          ) : (
            <span className="text-gray-400">No hay anterior</span>
          )}
        </div>
        <div>
          {next ? (
            <Link href={`/blog/${next.slug}`} className="text-blue-600 underline">
              {next.title} →
            </Link>
          ) : (
            <span className="text-gray-400">No hay siguiente</span>
          )}
        </div>
      </nav>
    </main>
  );
}
