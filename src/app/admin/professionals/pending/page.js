import { prisma } from '@/lib/prisma';
import PendingProfessionalsList from '@/components/admin/PendingProfessionalsList';

// Forzamos que esta página no se guarde en caché estático, para ver siempre los nuevos registros
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Profesionales Pendientes | Admin',
};

export default async function PendingProfessionalsPage() {
  // 1. Buscamos SOLO los profesionales NO aprobados (isApproved: false)
  const pendingPros = await prisma.professional.findMany({
    where: {
      isApproved: false,
    },
    orderBy: {
      createdAt: 'desc', // Los más recientes primero
    },
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      phone: true,
      createdAt: true,
      resumeUrl: true,
      // Agrega más campos si quieres verlos en la tabla
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes Pendientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Revisa y aprueba a los nuevos profesionales registrados.
          </p>
        </div>
        <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-full text-sm font-bold">
          {pendingPros.length} Pendiente{pendingPros.length !== 1 && 's'}
        </div>
      </div>

      {/* Renderizamos el componente cliente con los datos del servidor */}
      <PendingProfessionalsList initialData={pendingPros} />
    </div>
  );
}