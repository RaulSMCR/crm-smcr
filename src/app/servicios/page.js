import Link from 'next/link';
import { prisma } from '@/lib/prisma'; // Asegúrate que esta ruta sea correcta

export const metadata = {
  title: 'Servicios | Salud Mental Costa Rica',
  description: 'Explora nuestros servicios de terapia, coaching y asesoría.',
};

export default async function ServiciosPage() {
  const services = await prisma.service.findMany({
    orderBy: {
      title: 'asc',
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      
      // Relación con profesionales
      professionals: {
        where: {
          isApproved: true, // Ojo: Si cambiaste a 'status: ACTIVE', actualiza esta línea
        },
        select: {
          id: true,
          name: true,
          declaredJobTitle: true, // <--- CORRECCIÓN 1: Usamos el nuevo campo
          // Si quisieras las categorías oficiales, descomenta esto:
          // categories: {
          //   select: { name: true }
          // }
        },
        take: 3, 
      },
    },
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Nuestros Servicios</h1>
        <p className="text-lg text-gray-600">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <article key={service.id} className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
            {/* Imagen del Servicio */}
            <div className="h-48 bg-gray-200 relative overflow-hidden">
              {service.imageUrl ? (
                <img 
                  src={service.imageUrl} 
                  alt={service.title} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-50 text-brand-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold text-brand-700 shadow-sm">
                ${Number(service.price)}
              </div>
            </div>

            <div className="p-6 flex flex-col flex-grow">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                <Link href={`/servicios/${service.slug}`} className="hover:text-brand-600 transition-colors">
                  {service.title}
                </Link>
              </h2>
              
              <p className="text-gray-600 mb-6 line-clamp-3 flex-grow">
                {service.description}
              </p>

              {/* Lista de profesionales disponibles */}
              {service.professionals.length > 0 && (
                <div className="mb-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Disponible con:</p>
                  <div className="flex -space-x-2 overflow-hidden">
                    {service.professionals.map((pro) => (
                      <div 
                        key={pro.id} 
                        className="relative inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 cursor-help" 
                        // CORRECCIÓN 2: Tooltip mejorado para ver la profesión al pasar el mouse
                        title={`${pro.name} - ${pro.declaredJobTitle || 'Profesional'}`}
                      >
                        {pro.name.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link 
                href={`/servicios/${service.slug}`}
                className="w-full mt-auto text-center bg-brand-600 text-white font-medium py-3 rounded-lg hover:bg-brand-700 transition-colors"
              >
                Ver Detalles
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}