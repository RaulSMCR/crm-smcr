//src/app/panel/paciente/page.js
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, logout } from "@/actions/auth-actions";
import { getMyAppointments } from "@/actions/patient-actions";

// Helper para fechas
const formatDate = (date) => {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    hour: '2-digit', 
    minute: '2-digit'
  }).format(date);
};

// Mapa de estados para etiquetas visuales
const STATUS_LABELS = {
  PENDING: { text: '⏳ Pendiente de Aprobación', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONFIRMED: { text: '✅ Confirmada', classes: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED_BY_PRO: { text: '❌ Cancelada por Profesional', classes: 'bg-red-100 text-red-800 border-red-200' },
  COMPLETED: { text: '🏁 Finalizada', classes: 'bg-gray-100 text-gray-800 border-gray-200' }
};

export default async function PacienteDashboard({ searchParams }) {
  const session = await getSession();

  // 1. Seguridad
  if (!session) redirect("/ingresar");
  
  // Si es profesional, lo mandamos a su panel correspondiente
  if (session.role === 'PROFESSIONAL') redirect("/panel/profesional");

  // 2. Cargar Datos
  const { data: appointments } = await getMyAppointments();
  
  const showSuccessMessage = searchParams?.new_appointment === 'true';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Citas</h1>
            <p className="text-gray-600">Hola, {session.user.name}</p>
          </div>
          <div className="flex gap-3">
             <Link href="/servicios" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                + Nueva Cita
             </Link>
             <form action={logout}>
                <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  Cerrar Sesión
                </button>
             </form>
          </div>
        </header>

        {/* Mensaje de Éxito tras reservar */}
        {showSuccessMessage && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 animate-fadeIn">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="font-bold text-green-800">¡Solicitud Enviada!</h3>
              <p className="text-green-700 text-sm">
                Tu cita ha sido registrada. El profesional la confirmará en breve y recibirás una notificación.
              </p>
            </div>
          </div>
        )}

        {/* Lista de Citas */}
        {appointments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-medium text-gray-900">No tienes citas programadas</h3>
            <p className="text-gray-500 mb-6">Encuentra al profesional ideal para ti.</p>
            <Link href="/servicios" className="text-blue-600 font-semibold hover:underline">
              Explorar Servicios &rarr;
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => {
              const statusConfig = STATUS_LABELS[appt.status] || STATUS_LABELS.PENDING;
              
              return (
                <div key={appt.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
                  
                  {/* Info de la Cita */}
                  <div className="flex gap-4">
                    {/* Avatar del Profesional */}
                    <div className="hidden sm:block w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                       {appt.professional.avatarUrl ? (
                         <img src={appt.professional.avatarUrl} alt="" className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">
                           {appt.professional.name.charAt(0)}
                         </div>
                       )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-gray-900 capitalize">
                        {formatDate(appt.date)}
                      </h3>
                      <div className="text-gray-600 mt-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm">
                        <span className="font-medium text-gray-900">{appt.professional.name}</span>
                        <span className="hidden sm:inline text-gray-300">•</span>
                        <span>{appt.service?.title || 'Consulta'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Estado y Precio */}
                  <div className="flex flex-col items-start md:items-end justify-center gap-2 min-w-[140px]">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.classes}`}>
                      {statusConfig.text}
                    </span>
                    {appt.service?.price && (
                        <span className="text-sm text-gray-500 font-medium">
                            ${Number(appt.service.price)}
                        </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}