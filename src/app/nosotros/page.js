import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Nosotros | Equipo Profesional',
  description: 'Conoce a nuestros especialistas en salud mental.',
};

export default async function NosotrosPage() {
  // Consulta corregida para coincidir con tu Schema.prisma
  const professionals = await prisma.professional.findMany({
    where: {
      isApproved: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      name: true,
      profession: true,
      // Usamos introVideoUrl si existe, o null
      introVideoUrl: true, 
      services: {
        take: 3,
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Nuestro Equipo</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Profesionales dedicados a tu bienestar emocional y mental, altamente calificados y aprobados por nuestra plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {professionals.map((pro) => (
          <div key={pro.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-48 bg-brand-100 flex items-center justify-center">
              {/* Placeholder de Avatar usando las iniciales */}
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-brand-600 shadow-inner">
                {pro.name.charAt(0)}
              </div>
            </div>
            
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900">{pro.name}</h2>
              <p className="text-brand-600 font-medium mb-4">{pro.profession}</p>
              
              {/* Sección de Servicios */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Especialidades:</p>
                <div className="flex flex-wrap gap-2">
                  {pro.services.length > 0 ? (
                    pro.services.map((s) => (
                      <span key={s.id} className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                        {s.title}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 italic">Consultas generales</span>
                  )}
                </div>
              </div>

              {pro.introVideoUrl && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <a 
                    href={pro.introVideoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    ▶ Ver video de presentación
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}