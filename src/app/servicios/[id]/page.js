//src/app/servicios/[id]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Generar metadatos dinámicos
export async function generateMetadata({ params }) {
  const { id } = params;
  
  const service = await prisma.service.findUnique({
    where: { id },
    select: { title: true, description: true }
  });

  if (!service) return { title: 'Servicio no encontrado' };

  return {
    title: `${service.title} | Salud Mental`,
    description: service.description?.substring(0, 160),
  };
}

export default async function ServiceDetailPage({ params }) {
  const { id } = params;

  // 1. Buscamos el servicio por ID
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      // Relación directa con profesionales
      professionals: {
        select: {
          id: true,
          name: true,
          specialty: true, // <--- CORREGIDO (antes declaredJobTitle)
          avatarUrl: true,
          bio: true
        }
      }
    }
  });

  if (!service) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Botón Volver */}
        <Link href="/servicios" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors">
          ← Volver a Servicios
        </Link>

        {/* Encabezado del Servicio */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gray-900 p-8 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{service.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm font-medium opacity-90">
              <span className="bg-white/20 px-3 py-1 rounded-full flex items-center gap-2">
                ⏱ {service.durationMin} min
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full flex items-center gap-2">
                💲 {Number(service.price)}
              </span>
            </div>
          </div>
          
          <div className="p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Descripción</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {service.description || "No hay descripción disponible para este servicio."}
            </p>
          </div>
        </div>

        {/* Lista de Profesionales Disponibles */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Profesionales Disponibles</h2>
        
        {service.professionals.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {service.professionals.map((pro) => (
              <div key={pro.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    {pro.avatarUrl ? (
                      <img src={pro.avatarUrl} alt={pro.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                        {pro.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{pro.name}</h3>
                    <p className="text-blue-600 text-sm font-medium">{pro.specialty || 'Profesional de Salud'}</p>
                  </div>
                </div>

                {pro.bio && (
                  <p className="text-gray-500 text-sm mb-6 line-clamp-2 flex-grow">
                    {pro.bio}
                  </p>
                )}

                <Link 
                  href={`/agendar/${pro.id}?serviceId=${service.id}`} // Pasamos el servicio pre-seleccionado
                  className="w-full py-3 bg-blue-600 text-white text-center rounded-lg font-bold hover:bg-blue-700 transition-colors mt-auto"
                >
                  Agendar Cita
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-6 text-center text-yellow-800">
            <p>Actualmente no hay profesionales asignados a este servicio.</p>
          </div>
        )}

      </div>
    </main>
  );
}