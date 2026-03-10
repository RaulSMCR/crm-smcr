import Link from "next/link";

export default function CategorySection({ categories, title }) {
  if (!categories || categories.length === 0) {
    return (
      <section className="bg-gray-50 py-12 text-center">
        <p className="text-gray-500">Cargando servicios...</p>
      </section>
    );
  }

  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-12 text-center text-3xl font-bold text-gray-800">
          {title || "Nuestros Servicios"}
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/servicios/${category.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-lg"
            >
              <div className="relative h-48 overflow-hidden bg-gray-200">
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
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <span className="text-4xl">Imagen</span>
                  </div>
                )}

                {category.artworkTitle || category.artworkAuthor || category.artworkNote ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-4 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {category.artworkTitle ? (
                      <div className="text-sm font-semibold">{category.artworkTitle}</div>
                    ) : null}
                    {category.artworkAuthor ? (
                      <div className="text-xs text-white/85">{category.artworkAuthor}</div>
                    ) : null}
                    {category.artworkNote ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/80">
                        {category.artworkNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-grow flex-col p-6">
                <h3 className="mb-2 text-xl font-bold text-gray-800 transition-colors group-hover:text-blue-600">
                  {category.name}
                </h3>
                <p className="flex-grow text-sm text-gray-600 line-clamp-3">{category.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-blue-600">
                  Ver mas
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
