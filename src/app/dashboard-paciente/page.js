import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Helper para formato de fecha
function fmtDateTime(dt) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(dt);
}

export const revalidate = 0; // Datos siempre frescos

export default async function DashboardPacientePage() {
  // 1. Verificar Sesión
  const token = cookies().get('sessionToken')?.value;
  if (!token) {
    return (
      <div className="p-10 text-center">
        <p>Debes iniciar sesión.</p>
        <Link href="/login" className="text-blue-600 underline">Ir al Login</Link>
      </div>
    );
  }

  let session;
  try {
    session = await verifyToken(token);
  } catch (error) {
    return <div className="p-10 text-center">Sesión expirada.</div>;
  }

  // 2. Obtener Citas del Paciente
  // Buscamos citas donde userId coincida con el usuario logueado
  const appointments = await prisma.appointment.findMany({
    where: {
      userId: session.userId, 
      status: { not: 'CANCELLED' }
    },
    include: {
      professional: {
        select: { name: true, profession: true, email: true }
      }
    },
    orderBy: { date: 'asc' }
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Turnos</h1>
          <p className="text-gray-600">Bienvenido, {session.name}</p>
        </div>
        <Link 
          href="/test-booking" 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          + Nueva Reserva
        </Link>
      </header>

      {appointments.length === 0 ? (
        <div className="bg-gray-50 border border-dashed rounded-lg p-10 text-center">
          <p className="text-gray-500 mb-4">No tienes citas programadas.</p>
          <Link href="/test-booking" className="text-blue-600 font-medium hover:underline">
            Buscar un profesional
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border">
          <ul className="divide-y divide-gray-100">
            {appointments.map((appt) => (
              <li key={appt.id} className="p-4 sm:p-6 hover:bg-gray-50 transition">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  
                  {/* Info de la Cita */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-blue-900">
                        {fmtDateTime(new Date(appt.date))}
                      </span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                        {appt.status}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      Con: {appt.professional.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {appt.professional.profession}
                    </p>
                  </div>

                  {/* Botón Cancelar (Podemos reutilizar el componente si lo hacemos genérico después) */}
                  <div className="text-sm text-gray-400">
                    ID: {appt.id.slice(-4)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
