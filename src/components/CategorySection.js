// src/components/CategorySection.js
// src/components/CategorySection.js
import Link from 'next/link';

export default function CategorySection({ categories, title }) {
  // 🛡️ Seguridad: Si por alguna razón los datos llegan vacíos, no rompemos la web
  if (!categories || categories.length === 0) {
    return (
      <section className="py-12 bg-gray-50 text-center">
        <p className="text-gray-500">Cargando servicios...</p>
      </section>
    );
  }

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        {/* Título de la Sección */}
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          {title || "Nuestros Servicios"}
        </h2>

        {/* Rejilla de Tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/servicios/${category.slug}`}
              className="group flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300"
            >
              {/* Imagen de la tarjeta */}
              <div className="h-48 overflow-hidden relative bg-gray-200">
                {category.imageUrl ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-4xl">📷</span>
                  </div>
                )}
              </div>

              {/* Contenido de la tarjeta */}
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-3 flex-grow">
                  {category.description}
                </p>
                <div className="mt-4 text-blue-600 font-medium text-sm flex items-center">
                  Ver más 
                  <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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