//src/app/nosotros/page.js
import { prisma } from '@/lib/prisma';
import ProfessionalProfileCard from '@/components/ProfessionalProfileCard';

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
      licenseNumber: true,
      // 2. CORRECCIÓN: Obtenemos nombre y foto desde la relación con User
      user: {
        select: {
          name: true,
          image: true 
        }
      },
      serviceAssignments: {
        take: 3,
        where: {
          status: 'APPROVED',
        },
        select: {
          service: {
            select: {
              id: true,
              title: true,
            },
          },
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
          <ProfessionalProfileCard key={pro.id} professional={pro} />
        ))}
      </div>
    </main>
  );
}
