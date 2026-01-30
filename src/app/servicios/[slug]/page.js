import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// Generar metadata dinámica para SEO
export async function generateMetadata({ params }) {
  const service = await prisma.service.findUnique({
    where: { slug: params.slug },
    select: { title: true, description: true },
  });

  if (!service) return { title: 'Servicio no encontrado' };

  return {
    title: `${service.title} | SMCR`,
    description: service.description,
  };
}

export default async function ServiceDetailPage({ params }) {
  const { slug } = params;

  // 1. QUERY CORREGIDA
  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      // Si tu modelo Service tiene relación con Category, déjalo. Si no, bórralo.
      // category: true, 
      
      professionals: {
        // IMPORTANTE: Ajustado a 'isApproved' según tu seed. 
        // Si ya migraste a 'status', cambia esto por: { status: 'ACTIVE' }
        where: { isApproved: true }, 
        
        include: {
          professional: {
            select: {
              id: true,
              name: true,
              declaredJobTitle: true, // <--- CORRECCIÓN PRINCIPAL
              avatarUrl: true,
              bio: true,
              // calendarUrl: true, // Descomenta si este campo existe en tu schema
            },
          },
        },
      },
    },
  });

  if (!service) {
    return notFound();
  }

  // 2. SANITIZACIÓN
  const basePriceString = service.price ? service.price.toString() : "0";

  return (
    <main className="container mx-auto py-10 px-4 space-y-8">
      {/* --- ENCABEZADO DEL SERVICIO --- */}
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600 mb-2">
          <Link href="/servicios" className="hover:underline">
            ← Volver a Servicios
          </Link>
          {/* Validación extra por si service.category es null */}
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
              
              // Lógica de precio: Override o Base
              const finalPrice = proLink.priceOverride 
                ? proLink.priceOverride.toString() 
                : basePriceString;

              return (
                <article 
                  key={proLink.id} 
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative w-16 h-16 flex-shrink-0">
                        {professional.avatarUrl ? (
                          <Image
                            src={professional.avatarUrl}
                            alt={professional.name}
                            fill
                            className="object-cover rounded-full border border-gray-100"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl border border-brand-200">
                            {professional.name.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Info Básica */}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                          {professional.name}
                        </h3>
                        {/* CORRECCIÓN DE UI: Usamos declaredJobTitle */}
                        <p className="text-sm text-brand-600 font-medium">
                          {professional.declaredJobTitle || "Profesional de Salud"}
                        </p>
                        {professional.bio && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                            {professional.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer: Precio y Botón */}
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 font-medium uppercase">Valor sesión</span>
                      <span className="text-xl font-bold text-gray-900">
                        ${finalPrice}
                      </span>
                    </div>

                    {/* Botón de Reservar */}
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
                      <button disabled className="bg-gray-200 text-gray-400 px-5 py-2 rounded-full text-sm font-medium cursor-not-allowed">
                        No disponible
                      </button>
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