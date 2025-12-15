// src/components/ServiceCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function ServiceCard({ service }) {
  const {
    id,
    slug,
    title,
    description,
    price,
    imageUrl = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&q=80&auto=format&fit=crop',
    professionalName,
  } = service || {};

  return (
    <article className="rounded-2xl overflow-hidden border bg-neutral-250 hover:shadow-lg transition-shadow">
      <div className="relative aspect-[16/9]">
        <Image
          src={imageUrl}
          alt={title || 'Servicio'}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {professionalName ? (
          <p className="text-sm text-brand-600">por {professionalName}</p>
        ) : null}
        {description ? (
          <p className="mt-2 text-sm text-brand-600 line-clamp-2">{description}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          {typeof price === 'number' ? (
            <span className="text-base font-semibold">${price.toFixed(2)}</span>
          ) : <span />}
          <Link
            href={slug ? `/servicios/${encodeURIComponent(slug)}` : '#'}
            className="text-sm text-brand-600 hover:underline"
          >
            Ver detalle
          </Link>
        </div>
      </div>
    </article>
  );
}
