// src/components/BlogPostCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function BlogPostCard({ post }) {
  const {
    slug,
    title,
    imageUrl,
    content,
    postType = 'TEXT',
    createdAt,
    author,
  } = post || {};

  // Fallback visual si no hay imageUrl
  const cover =
    imageUrl ||
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&q=80&auto=format&fit=crop';

  return (
    <article className="rounded-2xl overflow-hidden border bg-white hover:shadow-lg transition-shadow">
      <div className="relative aspect-[16/9]">
        <Image
          src={cover}
          alt={title || 'Artículo'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {postType ? <span className="uppercase tracking-wide">{postType}</span> : null}
          {createdAt ? <span>• {new Date(createdAt).toLocaleDateString()}</span> : null}
        </div>

        <h3 className="mt-1 text-lg font-semibold line-clamp-2">{title}</h3>
        {author?.name ? (
          <p className="text-sm text-gray-600">por {author.name}</p>
        ) : null}

        {content ? (
          <p className="mt-2 text-sm text-gray-600 line-clamp-3">{content}</p>
        ) : null}

        <div className="mt-3">
          <Link
            href={slug ? `/blog/${encodeURIComponent(slug)}` : '#'}
            className="text-sm text-blue-600 hover:underline"
          >
            Leer más
          </Link>
        </div>
      </div>
    </article>
  );
}
