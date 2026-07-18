// src/components/ServiceCard.js
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

export default function ServiceCard({ service }) {
  const {
    slug,
    title,
    description,
    price,
    imageUrl = IMAGE_FALLBACKS.service,
    professionalName,
  } = service || {};

  return (
    <article className="overflow-hidden rounded-2xl border bg-neutral-250 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/9]">
        <SafeImage
          src={imageUrl}
          alt={title || "Servicio"}
          fallbackSrc={IMAGE_FALLBACKS.service}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {professionalName ? <p className="text-sm text-brand-600">por {professionalName}</p> : null}
        {description ? <p className="mt-2 line-clamp-2 text-sm text-brand-600">{description}</p> : null}

        <div className="mt-3 flex items-center justify-between">
          {typeof price === "number" ? (
            <span className="text-base font-semibold">${price.toFixed(2)}</span>
          ) : (
            <span />
          )}
          <Link
            href={slug ? `/servicios/${encodeURIComponent(slug)}` : "#"}
            className="text-sm text-brand-600 hover:underline"
          >
            Ver detalle
          </Link>
        </div>
      </div>
    </article>
  );
}
