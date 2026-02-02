//src/app/nosotros/page.js
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Nosotros | Equipo Profesional',
  description: 'Conoce a nuestros especialistas en salud mental.',
};

export const dynamic = 'force-dynamic';

export default async function NosotrosPage() {
  // 1. CORRECCIÓN: Usamos 'professionalProfile' en lugar de 'professional'
  const professionals = await prisma.professionalProfile.findMany({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      specialty: true,
      bio: true,
      slug: true,
      // 2. CORRECCIÓN: Obtenemos nombre y foto desde la relación con User
      user: {
        select: {
          name: true,
          image: true 
        }
      },
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
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Nuestro Equipo</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Profesionales dedicados a tu bienestar emocional y mental, altamente calificados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {professionals.map((pro) => (
          <div key={pro.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col">
            
            {/* Cabecera con Avatar */}
            <div className="h-32 bg-gradient-to-r from-blue-50 to-indigo-50 relative">
               <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white flex items-center justify-center">
                    {/* 3. CORRECCIÓN JSX: pro.user.image */}
                    {pro.user.image ? (
                      <img 
                        src={pro.user.image} 
                        alt={pro.user.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-blue-600">
                        {/* 4. CORRECCIÓN JSX: pro.user.name */}
                        {pro.user.name.charAt(0)}
                      </span>
                    )}
                  </div>
               </div>
            </div>
            
            <div className="pt-14 pb-6 px-6 text-center flex-grow flex flex-col">
              {/* 5. CORRECCIÓN JSX: pro.user.name */}
              <h2 className="text-xl font-bold text-gray-900 mb-1">{pro.user.name}</h2>
              
              {/* Especialidad */}
              <p className="text-blue-600 font-medium mb-3 text-sm uppercase tracking-wide">
                {pro.specialty || 'Profesional de Salud'}
              </p>
              
              {/* Bio corta */}
              {pro.bio && (
                <p className="text-gray-500 text-sm mb-4 line-clamp-3">
                  {pro.bio}
                </p>
              )}
              
              {/* Servicios (Badges) */}
              <div className="mt-auto">
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {pro.services.length > 0 ? (
                    pro.services.map((s) => (
                      <span key={s.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {s.title}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">Consultas generales</span>
                  )}
                </div>

                <Link 
                   href={`/agendar/${pro.id}`} // El ID del perfil sigue siendo correcto para la URL
                   className="inline-block w-full py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                   Agendar Cita
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}