// src/components/CategoryCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function CategoryCard({ category }) {
  const {
    name,
    slug,
    imageUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80&auto=format&fit=crop',
    description,
  } = category || {};

  return (
    <Link
      href={`/servicios/${encodeURIComponent(slug || '')}`}
      className="group block rounded-2xl overflow-hidden border neutral-300 hover:shadow-lg transition-shadow"
    >
      <div className="text-brand-600 relative aspect-[16/9]">
        <Image
          src={imageUrl}
          alt={name || 'Categoría'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
          priority={false}
        />
      </div>

      <div className="text-brand-600 p-4">
        <h3 className="text-brand-600 text-2xl font-semibold">{name}</h3>
        {description ? (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{description}</p>
        ) : null}
        <p className="mt-3 text-sm text-brand-600 group-hover:underline">Ver servicios</p>
      </div>
    </Link>
  );
}
