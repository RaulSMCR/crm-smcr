// src/app/panel/profesional/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions"; // Usamos tu server action
import { prisma } from "@/lib/prisma";

// Forzamos a que esta página sea dinámica (no cacheada estáticamente) para ver cambios en tiempo real
export const dynamic = 'force-dynamic';

export default async function ProfessionalDashboard() {
  // 1. Verificamos sesión en el SERVIDOR (Más seguro, sin errores de cliente)
  const session = await getSession();

  // Si no hay sesión, fuera
  if (!session) {
    redirect("/ingresar");
  }

  // Si el rol no es profesional, redirigir a su panel correspondiente
  if (session.role !== 'PROFESSIONAL') {
    if (session.role === 'ADMIN') redirect("/panel/admin");
    if (session.role === 'USER') redirect("/panel/paciente");
  }

  // 2. Consultamos datos FRESCOS de la base de datos
  // (No confiamos solo en la cookie para datos críticos)
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub },
    include: {
      user: true,
      appointments: {
        where: { date: { gte: new Date() } }, // Citas futuras
        orderBy: { date: 'asc' },
        take: 5
      }
    }
  });

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600">
        Error: No se encontró el perfil profesional asociado.
      </div>
    );
  }

  // 3. Manejo de Estado "No Aprobado" visualmente
  if (!profile.user.isApproved) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-yellow-200 max-w-lg text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Cuenta en Revisión</h1>
          <p className="text-slate-600 mb-6">
            Hola <strong>{profile.user.name}</strong>, tu perfil está siendo revisado por la administración. 
            Te notificaremos por correo cuando tu cuenta esté activa para recibir pacientes.
          </p>
          <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm">
            Si crees que esto es un error, contacta a soporte.
          </div>
        </div>
      </div>
    );
  }

  // 4. DASHBOARD ACTIVO (Renderizado en Servidor)
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Hola, {profile.user.name.split(' ')[0]} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Panel de Control Profesional • {profile.specialty}
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-3">
             <span className={`px-3 py-1 rounded-full text-xs font-bold ${profile.user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {profile.user.isActive ? 'OPERATIVO' : 'INACTIVO'}
             </span>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard 
            title="Próximas Citas" 
            value={profile.appointments.length} 
            icon="📅" 
            color="blue"
          />
          <DashboardCard 
            title="Calificación" 
            value={profile.rating ? Number(profile.rating).toFixed(1) : "-"} 
            icon="⭐" 
            color="yellow"
          />
          <DashboardCard 
            title="Estado Matrícula" 
            value={profile.licenseNumber ? "Verificada" : "Pendiente"} 
            icon="🪪" 
            color="purple"
          />
        </div>

        {/* Sección de Citas Próximas */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Próximos Turnos</h3>
          </div>
          
          {profile.appointments.length === 0 ? (
             <div className="p-12 text-center text-slate-400">
                <p>No tienes citas programadas próximamente.</p>
             </div>
          ) : (
            <div className="divide-y divide-slate-50">
               {profile.appointments.map((appt) => (
                 <div key={appt.id} className="p-4 hover:bg-slate-50 flex justify-between items-center transition">
                    <div>
                      <p className="font-semibold text-slate-700">
                        {new Date(appt.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="text-sm text-slate-500">
                        {new Date(appt.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute:'2-digit' })} hs
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
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

// Subcomponente simple para tarjetas
function DashboardCard({ title, value, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600"
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-2xl ${colors[color] || colors.blue}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}