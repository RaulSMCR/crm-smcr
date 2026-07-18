// src/components/CategoryCard.js
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

export default function CategoryCard({ category }) {
  const {
    name,
    slug,
    imageUrl = IMAGE_FALLBACKS.service,
    description,
  } = category || {};

  return (
    <Link
      href={`/servicios/${encodeURIComponent(slug || "")}`}
      className="group block overflow-hidden rounded-2xl border neutral-300 transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] text-brand-600">
        <SafeImage
          src={imageUrl}
          alt={name || "Categoria"}
          fallbackSrc={IMAGE_FALLBACKS.service}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="p-4 text-brand-600">
        <h3 className="text-2xl font-semibold text-brand-600">{name}</h3>
        {description ? <p className="mt-1 line-clamp-2 text-sm text-gray-600">{description}</p> : null}
        <p className="mt-3 text-sm text-brand-600 group-hover:underline">Ver servicios</p>
      </div>
    </Link>
  );
}
