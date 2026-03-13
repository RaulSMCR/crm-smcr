import Link from "next/link";

export default function CategorySection({ categories, title }) {
  if (!categories || categories.length === 0) {
    return (
      <section className="bg-neutral-50 py-12 text-center">
        <p className="text-neutral-700">Cargando servicios...</p>
      </section>
    );
  }

  return (
    <section className="bg-appbg py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-12 text-center text-3xl font-bold text-brand-900">
          {title || "Nuestros servicios"}
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/servicios/${category.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 shadow-card transition-all duration-300 hover:border-brand-400"
            >
              <div className="relative h-48 overflow-hidden bg-neutral-200">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="h-full w-full object-cover transition-transform duration-500"
                    style={{
                      objectPosition: category.imagePosition || "50% 50%",
                      transform: `scale(${(category.imageScale || 100) / 100})`,
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-600">
                    <span className="text-xl font-semibold">Imagen</span>
                  </div>
                )}

                {category.artworkTitle || category.artworkAuthor || category.artworkNote ? (
                  <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-brand-950/94 p-4 text-white opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                    <div className="mb-2 inline-flex rounded-full bg-accent-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-50">
                      Obra destacada
                    </div>
                    {category.artworkTitle ? (
                      <div className="text-sm font-semibold text-neutral-50">{category.artworkTitle}</div>
                    ) : null}
                    {category.artworkAuthor ? (
                      <div className="text-xs text-neutral-100/90">{category.artworkAuthor}</div>
                    ) : null}
                    {category.artworkNote ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-100/90">
                        {category.artworkNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-grow flex-col p-6">
                <h3 className="mb-2 text-xl font-bold text-brand-900 transition-colors group-hover:text-brand-800">
                  {category.name}
                </h3>
                <p className="flex-grow line-clamp-3 text-sm text-neutral-800">
                  {category.description}
                </p>
                <div className="mt-4 flex items-center text-sm font-semibold text-accent-900">
                  Ver más
                  <svg
                    className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
