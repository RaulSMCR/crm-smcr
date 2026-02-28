//src/components/UserAppointmentsPanel.js
'use client';

import { formatDateTimeInTZ, DEFAULT_TZ } from '@/lib/timezone';
import { useState } from 'react';
import Link from 'next/link';
import CancelAppointmentModal from './appointments/CancelAppointmentModal';
import RescheduleAppointmentModal from './appointments/RescheduleAppointmentModal';
import { cancelAppointmentByPatient } from '@/actions/patient-booking-actions';

// Helpers para formatear con timezone de Costa Rica
const formatDateInTZ = (date) => {
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: DEFAULT_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(date));
};

const formatTimeInTZ = (date) => {
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: DEFAULT_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export default function UserAppointmentsPanel({ initialAppointments = [] }) {
  // Inicializamos el estado con los datos que vienen del servidor (Page)
  // Usamos estado por si luego queremos filtrar/ordenar sin recargar la página
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'UPCOMING', 'PAST'
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);

  async function handleCancel(appointmentId, reason) {
    const result = await cancelAppointmentByPatient(appointmentId, reason);
    if (result?.success) {
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status: 'CANCELLED_BY_USER' } : a)
      );
    }
    return result;
  }

  // Helper para mostrar estados bonitos en español
  const getStatusBadge = (status) => {
    const config = {
      PENDING: { label: 'Pendiente', style: 'bg-amber-500 text-white border-amber-500' },
      CONFIRMED: { label: 'Confirmada', style: 'bg-green-600 text-white border-green-600' },
      CANCELLED_BY_USER: { label: 'Cancelada', style: 'bg-red-600 text-white border-red-600' },
      CANCELLED_BY_PRO: { label: 'Cancelada por Prof.', style: 'bg-red-600 text-white border-red-600' },
      COMPLETED: { label: 'Completada', style: 'bg-slate-600 text-white border-slate-600' },
      NO_SHOW: { label: 'Ausente', style: 'bg-purple-600 text-white border-purple-600' }
    };

    const current = config[status] || { label: status, style: 'bg-gray-100' };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${current.style}`}>
        {current.label}
      </span>
    );
  };

  // Lógica simple de filtrado visual
  const filteredAppointments = appointments.filter(apt => {
    if (filter === 'ALL') return true;
    const isPast = new Date(apt.date) < new Date();
    return filter === 'PAST' ? isPast : !isPast;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Cabecera del Panel con Filtros */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-gray-800">Mis Citas</h2>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          {['ALL', 'UPCOMING', 'PAST'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {f === 'ALL' ? 'Todas' : f === 'UPCOMING' ? 'Próximas' : 'Historial'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Citas */}
      <div className="divide-y divide-gray-100">
        {filteredAppointments.length > 0 ? (
          filteredAppointments.map((apt) => (
            <div key={apt.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row justify-between gap-4">

              {/* Información Principal */}
              <div className="flex gap-4">
                {/* Avatar del Profesional (Placeholder si es null) */}
                <div className="flex-shrink-0">
                  {apt.professional.user?.image ? (
                    <img src={apt.professional.user.image} alt={apt.professional.user?.name} className="w-12 h-12 rounded-full object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {apt.professional.user?.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">{apt.professional.user?.name}</h3>
                  <p className="text-sm text-gray-500">{apt.service?.title || 'Consulta General'}</p>

                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      {/* Icono Calendario */}
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      {formatDateInTZ(apt.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Icono Reloj */}
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      {formatTimeInTZ(apt.date)} hs
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado y Acciones */}
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(apt.status)}

                {/* Precio */}
                {apt.service?.price && (
                  <span className="text-sm font-medium text-gray-900">
                    ${Number(apt.service.price).toLocaleString('es-AR')}
                  </span>
                )}

                {/* Botones de acción (Solo si es pendiente o confirmada y futura) */}
                {(apt.status === 'PENDING' || apt.status === 'CONFIRMED') && new Date(apt.date) > new Date() && (
                  <>
                    {apt.status === 'CONFIRMED' ? (
                      <button
                        onClick={() => setReschedulingApt(apt)}
                        className="mt-2 w-full px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Reagendar
                      </button>
                    ) : (
                      <div className="mt-2 w-full px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold text-center cursor-default">
                        Pendiente de confirmación
                      </div>
                    )}
                    <button
                      onClick={() => setCancelingApt(apt)}
                      className="mt-2 w-full px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      Cancelar cita
                    </button>
                  </>
                )}
              </div>

            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay citas en esta lista</h3>
            <p className="text-gray-500 max-w-sm mx-auto mt-1">
              {filter === 'ALL'
                ? 'Aún no has agendado ninguna cita con nuestros profesionales.'
                : 'No tienes citas que coincidan con este filtro.'}
            </p>
          </div>
        )}
      </div>

      {/* Accesos rápidos debajo del reporte */}
      <div className="p-6 border-t border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-end">
          <Link
            href="/servicios"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
          >
            Explorar servicios
          </Link>
          <Link
            href="/blog"
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors text-center"
          >
            Seguir aprendiendo
          </Link>
        </div>
      </div>

      {/* Modal de reagendamiento */}
      {reschedulingApt && (
        <RescheduleAppointmentModal
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
        />
      )}

      {/* Modal de cancelación */}
      {cancelingApt && (
        <CancelAppointmentModal
          appointment={cancelingApt}
          onCancel={handleCancel}
          onClose={() => setCancelingApt(null)}
          role="patient"
        />
      )}
    </div>
  );
}
