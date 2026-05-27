"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const FALLBACK_ARTICLE_IMAGE =
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1600&q=80&auto=format&fit=crop";

const KIND_META = {
  ARTICLE_NEW: {
    title: "Articulo nuevo",
    badge: "bg-brand-100 text-brand-950 border-brand-200",
  },
  PROFESSIONAL_NEW: {
    title: "Profesional nuevo",
    badge: "bg-accent-100 text-accent-950 border-accent-200",
  },
  ARTICLE_FEATURED: {
    title: "Articulo destacado",
    badge: "bg-neutral-950 text-white border-neutral-950",
  },
  PROFESSIONAL_FEATURED: {
    title: "Profesional destacado",
    badge: "bg-brand-700 text-white border-brand-700",
  },
};

function initialFor(name) {
  return String(name || "S").trim().charAt(0).toUpperCase() || "S";
}

function ProfessionalAvatar({ professional }) {
  const image = professional?.image;
  const name = professional?.name || "Profesional";

  return (
    <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-brand-100 shadow-card md:h-44 md:w-44">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-brand-800">
          {initialFor(name)}
        </div>
      )}
    </div>
  );
}

function ArticleImage({ article }) {
  const src = article?.image || FALLBACK_ARTICLE_IMAGE;

  return (
    <div className="relative min-h-[260px] overflow-hidden bg-neutral-100 md:min-h-[420px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={article?.title || "Articulo"}
        className="h-full min-h-[260px] w-full object-cover md:min-h-[420px]"
        style={{
          objectPosition: `${article?.focusX ?? 50}% ${article?.focusY ?? 50}%`,
          transform: `scale(${(article?.scale ?? 100) / 100})`,
        }}
      />
    </div>
  );
}

function ArticleSlide({ item, meta }) {
  const article = item.article;
  const author = article?.author || {};

  return (
    <article className="grid overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-card md:grid-cols-[0.95fr_1.05fr]">
      <ArticleImage article={article} />

      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        <span className={`mb-4 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase ${meta.badge}`}>
          {item.label || meta.title}
        </span>

        <h3 className="text-2xl font-bold leading-tight text-neutral-950 sm:text-3xl">
          {article?.title}
        </h3>

        <div className="mt-4 flex items-center gap-3 border-y border-neutral-200 py-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-900">
            {author.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initialFor(author.name)
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-950">{author.name || "Redaccion"}</p>
            {author.specialty ? <p className="text-xs text-neutral-600">{author.specialty}</p> : null}
          </div>
        </div>

        {article?.summary ? (
          <p className="mt-5 line-clamp-4 text-sm leading-6 text-neutral-700 sm:text-base">
            {article.summary}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/blog/${article?.slug}`}
            className="inline-flex items-center justify-center rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900"
          >
            Leer articulo
          </Link>
          {author.slug ? (
            <Link
              href={`/blog?autor=${author.slug}`}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
            >
              Mas del autor
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProfessionalSlide({ item, meta }) {
  const professional = item.professional;
  const publicHref = professional?.slug ? `/profesionales/${professional.slug}` : `/agendar/${professional?.id}`;

  return (
    <article className="grid overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-card md:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-brand-700 via-brand-600 to-accent-700 px-6 py-10 text-center text-white">
        <ProfessionalAvatar professional={professional} />
        <h3 className="mt-6 text-2xl font-bold">{professional?.name}</h3>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/85">
          {professional?.specialty || "Profesional de salud"}
        </p>
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
        <span className={`mb-4 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase ${meta.badge}`}>
          {item.label || meta.title}
        </span>

        <div className="space-y-3">
          {professional?.licenseNumber ? (
            <p className="text-sm text-neutral-700">
              <span className="font-semibold text-neutral-950">Matricula profesional:</span>{" "}
              {professional.licenseNumber}
            </p>
          ) : null}

          {professional?.review ? (
            <p className="line-clamp-5 text-sm leading-6 text-neutral-700 sm:text-base">
              {professional.review}
            </p>
          ) : (
            <p className="text-sm leading-6 text-neutral-700">
              Profesional verificado por Salud Mental Costa Rica.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {professional?.services?.length ? (
            professional.services.map((service) => (
              <span
                key={service.id}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700"
              >
                {service.title}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
              Consulta general
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={publicHref}
            className="inline-flex items-center justify-center rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-900"
          >
            Ver perfil
          </Link>
          {professional?.id ? (
            <Link
              href={`/agendar/${professional.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
            >
              Agendar cita
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function HomeFeatureCarousel({ items = [] }) {
  const slides = useMemo(
    () =>
      items.filter((item) => {
        if (!KIND_META[item.kind]) return false;
        if (item.kind.startsWith("ARTICLE")) return Boolean(item.article?.slug);
        return Boolean(item.professional?.id);
      }),
    [items]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (!slides.length) return null;

  const active = slides[index] || slides[0];
  const meta = KIND_META[active.kind];

  return (
    <section className="bg-surface px-4 pb-14 pt-2">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">
              Actualidad
            </p>
            <h2 className="mt-1 text-2xl font-bold text-neutral-950 sm:text-3xl">
              Novedades y destacados
            </h2>
          </div>

          {slides.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}
                className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setIndex((current) => (current + 1) % slides.length)}
                className="h-10 rounded-lg bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </div>

        {active.kind.startsWith("ARTICLE") ? (
          <ArticleSlide item={active} meta={meta} />
        ) : (
          <ProfessionalSlide item={active} meta={meta} />
        )}

        {slides.length > 1 ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Piezas del carrusel">
            {slides.map((slide, slideIndex) => {
              const slideMeta = KIND_META[slide.kind];
              const isSelected = slideIndex === index;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setIndex(slideIndex)}
                  aria-label={`Ver ${slide.label || slideMeta.title}`}
                  className={[
                    "h-2.5 rounded-full transition-all",
                    isSelected ? "w-9 bg-brand-800" : "w-2.5 bg-neutral-300 hover:bg-neutral-500",
                  ].join(" ")}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
