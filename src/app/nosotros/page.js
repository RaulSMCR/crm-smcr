import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Nuestro Equipo | SMCR',
  description: 'Conoce a los profesionales de Salud Mental Costa Rica',
};

export default async function NosotrosPage() {
  // 1. QUERY CORREGIDA: Tabla Professional directa
  const professionals = await prisma.professional.findMany({
    where: {
      isApproved: true,      // Solo aprobados
      emailVerified: true,   // Solo verificados
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      name: true,
      profession: true, // En el esquema nuevo se llama "profession"
      avatarUrl: true,
      bio: true,
      // Opcional: Traer los servicios que ofrece para mostrar etiquetas
      services: {
        where: { status: 'ACTIVE' },
        select: {
          service: {
            select: { title: true }
          }
        },
        take: 3 // Solo mostramos los 3 primeros como resumen
      }
    },
  });

  return (
    <main className="container mx-auto py-12 px-4">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl font-bold text-brand-700 mb-4">Nuestro Equipo</h1>
        <p className="text-lg text-gray-600">
          Profesionales certificados y comprometidos con tu bienestar emocional y mental.
        </p>
      </div>

      {professionals.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <p className="text-gray-500">Aún no hay profesionales públicos en el directorio.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {professionals.map((pro) => (
            <div 
              key={pro.id} 
              className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center"
            >
              {/* Avatar Grande */}
              <div className="relative w-32 h-32 mb-4">
                {pro.avatarUrl ? (
                  <Image
                    src={pro.avatarUrl}
                    alt={pro.name}
                    fill
                    className="object-cover rounded-full border-4 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-brand-100 flex items-center justify-center text-4xl text-brand-600 font-bold">
                    {pro.name.charAt(0)}
                  </div>
                )}
              </div>

              <h3 className="text-xl font-bold text-gray-900">{pro.name}</h3>
              <p className="text-brand-600 font-medium mb-3">{pro.profession}</p>
              
              {/* Bio truncada */}
              <p className="text-sm text-gray-500 mb-6 line-clamp-3 px-2">
                {pro.bio || "Profesional de SMCR comprometido con la excelencia."}
              </p>

              {/* Etiquetas de Servicios (Opcional) */}
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {pro.services.map((s, idx) => (
                  <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                    {s.service.title}
                  </span>
                ))}
              </div>

              {/* Botón de Perfil Completo (si tuvieras página de perfil individual) 
                  o Botón de Reservar genérico */}
              <div className="mt-auto w-full">
                {/* Nota: Como no tenemos página de perfil individual pública definida en el sitemap aún,
                   podemos dirigir a la página de servicios o dejarlo pendiente.
                   Por ahora, mostramos un botón decorativo o link a servicios.
                */}
                <Link 
                  href="/servicios" 
                  className="block w-full py-2 px-4 bg-white border border-brand-200 text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors"
                >
                  Ver Servicios
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}