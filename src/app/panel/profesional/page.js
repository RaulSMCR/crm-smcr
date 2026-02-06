// src/app/panel/profesional/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions"; 
import { prisma } from "@/lib/prisma";

// Forzar renderizado dinámico para evitar caché viejo
export const dynamic = 'force-dynamic';

export default async function ProfessionalDashboard() {
  // 1. Verificación de Sesión
  const session = await getSession();

  if (!session) {
    redirect("/ingresar");
  }

  // Protección de Roles
  if (session.role !== 'PROFESSIONAL') {
    return redirect(session.role === 'ADMIN' ? "/panel/admin" : "/panel/paciente");
  }

  // 2. Consulta a Base de Datos (Datos Frescos)
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub },
    include: {
      user: true,
      appointments: {
        where: { date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 5
      }
    }
  });

  if (!profile) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-xl font-bold text-red-600">Error de Perfil</h1>
        <p>No se encontró el perfil profesional. Contacta a soporte.</p>
      </div>
    );
  }

  // 3. Serialización de Datos (EL FIX CLAVE)
  // Convertimos las fechas a Strings simples AQUÍ para evitar errores en el cliente
  const safeAppointments = profile.appointments.map(appt => ({
    id: appt.id,
    dateString: appt.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
    timeString: appt.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute:'2-digit' }),
    status: appt.status || "Pendiente" // Valor por defecto
  }));

  const isActive = profile.user.isActive;
  const isApproved = profile.user.isApproved;
  const rating = profile.rating ? Number(profile.rating).toFixed(1) : "-";
  const licenseStatus = profile.licenseNumber ? "Verificada" : "Pendiente";

  // 4. Pantalla de "Esperando Aprobación"
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-yellow-200 max-w-lg text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Cuenta en Revisión</h1>
          <p className="text-slate-600 mb-6">
            Hola <strong>{profile.user.name}</strong>, tu documentación está siendo validada.
            <br/>Te avisaremos por correo cuando puedas recibir pacientes.
          </p>
          <form action={async () => {
            'use server';
            // Pequeño hack para permitir logout desde aquí si se queda trabado
            const { cookies } = await import("next/headers");
            cookies().delete("session");
            redirect("/ingresar");
          }}>
            <button className="text-blue-600 underline text-sm hover:text-blue-800">
              Cerrar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 5. Dashboard Operativo
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Panel Profesional
            </h1>
            <p className="text-slate-500 text-sm">
              Bienvenido, {profile.user.name}
            </p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
             {isActive ? 'CUENTA ACTIVA' : 'INACTIVO'}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-2xl">📅</div>
            <div>
              <p className="text-slate-500 text-xs uppercase font-bold">Próximas Citas</p>
              <p className="text-2xl font-bold text-slate-900">{safeAppointments.length}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="h-12 w-12 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center text-2xl">⭐</div>
            <div>
              <p className="text-slate-500 text-xs uppercase font-bold">Calificación</p>
              <p className="text-2xl font-bold text-slate-900">{rating}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center text-2xl">🪪</div>
            <div>
              <p className="text-slate-500 text-xs uppercase font-bold">Licencia</p>
              <p className="text-2xl font-bold text-slate-900">{licenseStatus}</p>
            </div>
          </div>
        </div>

        {/* Lista de Citas (Usando datos seguros) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-700">Agenda Próxima</h3>
          </div>
          
          {safeAppointments.length === 0 ? (
             <div className="p-10 text-center text-slate-400">
                <p>No hay citas programadas.</p>
             </div>
          ) : (
            <div className="divide-y divide-slate-50">
               {safeAppointments.map((appt) => (
                 <div key={appt.id} className="p-4 hover:bg-slate-50 flex justify-between items-center transition duration-150">
                    <div>
                      <p className="font-semibold text-slate-700 capitalize">
                        {appt.dateString}
                      </p>
                      <p className="text-sm text-slate-500">
                        {appt.timeString} hs
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium border border-blue-100">
                      Confirmada
                    </span>
                 </div>
               ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}