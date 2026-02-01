// src/app/admin/page.js
import { prisma } from '@/lib/prisma';
import { getSession } from '@/actions/auth-actions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PendingProfessionalsList from '@/components/admin/PendingProfessionalsList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard Administrativo | CRM SMCR',
};

export default async function AdminDashboardPage() {
  // 1. SEGURIDAD: Verificar sesión y rol
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/ingresar');
  }

  // 2. OBTENER DATOS (Estadísticas + Lista de Pendientes)
  const [
    totalUsers,
    totalPros,
    pendingProsCount,
    upcomingAppointments,
    pendingProsList // <--- Traemos la lista completa, no solo el número
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),
    prisma.professional.count(),
    prisma.professional.count({ where: { isApproved: false } }),
    prisma.appointment.count({ where: { date: { gte: new Date() } } }),
    
    // Consulta para la tabla
    prisma.professional.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Control</h1>
        <div className="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg text-sm font-medium border border-blue-100">
          Admin: {session.user.name}
        </div>
      </div>
      
      {/* GRID DE ESTADÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        
        {/* Tarjeta 1: Usuarios */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Pacientes</dt>
                  <dd className="text-lg font-medium text-gray-900">{totalUsers}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Profesionales */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Profesionales</dt>
                  <dd className="text-lg font-medium text-gray-900">{totalPros}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Pendientes (Ahora hace scroll a la lista) */}
        <a href="#pending-list" className="block group">
          <div className="bg-white overflow-hidden shadow rounded-lg border-2 border-transparent group-hover:border-yellow-400 transition-colors cursor-pointer">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate group-hover:text-yellow-600">Solicitudes Pendientes</dt>
                    <dd className="text-lg font-medium text-gray-900">{pendingProsCount}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </a>

        {/* Tarjeta 4: Citas */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Citas Futuras</dt>
                  <dd className="text-lg font-medium text-gray-900">{upcomingAppointments}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECCIÓN DE LISTA DE PENDIENTES */}
      <div id="pending-list" className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
                Gestionar Solicitudes ({pendingProsCount})
            </h3>
        </div>
        
        {/* Aquí insertamos el componente interactivo */}
        <PendingProfessionalsList professionals={pendingProsList} />
      </div>

    </div>
  );
}