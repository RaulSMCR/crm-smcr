//src/app/servicios/[slug]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// Generar metadata dinámica para SEO
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });

  if (!service) return { title: 'Servicio no encontrado' };

  return {
    title: `${service.title} | SMCR`,
    description: service.description,
  };
}

export default async function ServiceDetailPage({ params }) {
  const { slug } = await params;

  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      professionals: {
        where: { isApproved: true }, 
        include: {
          professional: {
            select: {
              id: true,
              name: true,
              declaredJobTitle: true,
              avatarUrl: true,
              bio: true,
              calendarUrl: true, 
            },
          },
        },
      },
    },
  });

  if (!service) {
    return notFound();
  }

  // Sanitización de precio
  const basePriceString = service.price ? service.price.toString() : "0";

  return (
    <main className="container mx-auto py-10 px-4 space-y-8">
      {/* --- ENCABEZADO DEL SERVICIO --- */}
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600 mb-2">
          <Link href="/servicios" className="hover:underline">
            ← Volver a Servicios
          </Link>
          {service.category && (
            <>
              <span className="text-gray-300">•</span>
              <span className="uppercase tracking-wider">{service.category.name}</span>
            </>
          )}
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          {service.title}
        </h1>
        
        <p className="text-xl text-gray-600 leading-relaxed mb-6">
          {service.description}
        </p>

        <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg">
          <span className="text-gray-500 mr-2 text-sm">Precio base:</span>
          <span className="text-2xl font-bold text-gray-900">${basePriceString}</span>
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* --- LISTA DE PROFESIONALES --- */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Especialistas disponibles ({service.professionals.length})
        </h2>

        {service.professionals.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-800">
            <p>Actualmente no hay profesionales asignados a este servicio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {service.professionals.map((proLink) => {
              const { professional } = proLink;
              
              // Lógica de precio
              const finalPrice = proLink.priceOverride 
                ? proLink.priceOverride.toString() 
                : basePriceString;

              return (
                <article 
                  key={proLink.id} 
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col group"
                >
                  <div className="p-6 flex-1">
                    {/* ENLACE AL PERFIL: Hacemos clicable la info principal */}
                    <Link href={`/profesional/${professional.id}`} className="flex items-start gap-4">
                      
                      {/* Avatar */}
                      <div className="relative w-16 h-16 flex-shrink-0">
                        {professional.avatarUrl ? (
                          <Image
                            src={professional.avatarUrl}
                            alt={professional.name}
                            fill
                            className="object-cover rounded-full border border-gray-100 group-hover:border-brand-300 transition-colors"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl border border-brand-200">
                            {professional.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Info Básica */}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-brand-600 transition-colors">
                          {professional.name}
                        </h3>
                        <p className="text-sm text-brand-600 font-medium">
                          {professional.declaredJobTitle || "Profesional de Salud"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 hover:underline">
                          Ver perfil completo →
                        </p>
                      </div>
                    </Link>
                    
                    {professional.bio && (
                       <p className="text-sm text-gray-500 mt-3 line-clamp-2">
                         {professional.bio}
                       </p>
                    )}
                  </div>

                  {/* Footer: Precio y Botón */}
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-medium uppercase">Valor sesión</span>
                      <span className="text-xl font-bold text-gray-900">
                        ${finalPrice}
                      </span>
                    </div>

                    {/* Botón de Acción */}
                    {professional.calendarUrl ? (
                      <a 
                        href={professional.calendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-black text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        Reservar
                      </a>
                    ) : (
                      // Si no hay calendario, llevamos al perfil
                      <Link 
                        href={`/profesional/${professional.id}`}
                        className="bg-white border border-brand-200 text-brand-700 px-5 py-2 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors"
                      >
                        Ver Perfil
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}