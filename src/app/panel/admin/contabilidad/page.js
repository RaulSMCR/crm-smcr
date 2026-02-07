import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function AdminAccountingPage() {
  // 1. Obtener citas con sus precios y relaciones
  const appointments = await prisma.appointment.findMany({
    orderBy: { date: 'desc' },
    include: {
      service: true, // Para sacar el precio
      professional: { include: { user: true } }, // Quién cobró
      patient: { select: { name: true } } // Quién pagó
    }
  });

  // 2. Cálculos Financieros
  const totalRevenue = appointments.reduce((acc, curr) => {
    return acc + (curr.service?.price || 0);
  }, 0);

  const totalAppointments = appointments.length;
  const averageTicket = totalAppointments > 0 ? totalRevenue / totalAppointments : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestión Contable</h1>
            <p className="text-slate-500">Estimación de ingresos basada en citas agendadas.</p>
        </div>
        <button className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded hover:bg-black transition opacity-50 cursor-not-allowed">
            📥 Descargar Reporte
        </button>
      </div>

      {/* TARJETAS DE KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Ingresos */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ingresos Totales (Est.)</p>
            <h2 className="text-3xl font-bold text-green-600">
                ${totalRevenue.toLocaleString('es-AR')}
            </h2>
        </div>
        
        {/* Cantidad Citas */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Citas Registradas</p>
            <h2 className="text-3xl font-bold text-blue-600">
                {totalAppointments}
            </h2>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ticket Promedio</p>
            <h2 className="text-3xl font-bold text-slate-700">
                ${averageTicket.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </h2>
        </div>
      </div>

      {/* TABLA DE MOVIMIENTOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-700">Últimos Movimientos</h3>
        </div>
        <table className="w-full text-left">
            <thead className="bg-white border-b border-slate-100">
                <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Servicio</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Profesional</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Paciente</th>
                    <th className="p-4 text-right text-xs font-bold text-slate-500 uppercase">Monto</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 text-sm text-slate-600">
                            {new Date(appt.date).toLocaleDateString('es-AR')}
                        </td>
                        <td className="p-4 text-sm font-medium text-slate-800">
                            {appt.service?.title || "Servicio Eliminado"}
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                            {appt.professional?.user?.name || "Desconocido"}
                        </td>
                        <td className="p-4 text-sm text-slate-500">
                            {appt.patient?.name || "Anónimo"}
                        </td>
                        <td className="p-4 text-right font-bold text-green-700">
                            + ${appt.service?.price?.toLocaleString() || 0}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        
        {appointments.length === 0 && (
            <div className="p-12 text-center text-slate-400">
                <p>No hay movimientos registrados aún.</p>
            </div>
        )}
      </div>
    </div>
  );
}
