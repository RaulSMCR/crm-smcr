import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import AvailabilityForm from '@/components/availability-form'; // Asegúrate que la ruta coincida

export const metadata = {
  title: 'Gestionar Horarios | CRM-SMCR',
};

export default async function HorariosPage() {
  // 1. Auth Check
  const token = cookies().get('sessionToken')?.value;
  const session = await verifyToken(token).catch(() => null);

  if (!session || session.role !== 'PROFESSIONAL') {
    return (
      <div className="p-10 text-center">
        <h1 className="text-xl font-bold text-red-600">Acceso Denegado</h1>
        <Link href="/login" className="text-blue-600 hover:underline">Ir al login</Link>
      </div>
    );
  }

  // 2. Cargar disponibilidad actual
  const currentAvailability = await prisma.availability.findMany({
    where: { professionalId: String(session.userId) },
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard-profesional" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
          &larr; Volver al Panel
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Disponibilidad Horaria</h1>
        <p className="text-gray-600 mt-2">
          Define los días y franjas horarias en las que aceptas citas. 
          Los pacientes solo podrán reservar dentro de estos intervalos.
        </p>
      </div>

      {/* Renderizamos el componente cliente pasándole los datos iniciales */}
      <AvailabilityForm initialAvailability={currentAvailability} />
    </main>
  );
}