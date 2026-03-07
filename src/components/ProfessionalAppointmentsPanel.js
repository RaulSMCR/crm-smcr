'use client';

import { useState } from 'react';
import { isFuture, isToday } from 'date-fns';
import { DEFAULT_TZ } from '@/lib/timezone';
import { updateAppointmentStatus, cancelAppointmentByProfessional } from '@/actions/agenda-actions';
import CancelAppointmentModal from './appointments/CancelAppointmentModal';
import ProfessionalRescheduleModal from './appointments/ProfessionalRescheduleModal';
import CreateProfessionalAppointmentModal from './appointments/CreateProfessionalAppointmentModal';
import AcceptRecurringAppointmentModal from './appointments/AcceptRecurringAppointmentModal';
import FollowUpModal from './appointments/FollowUpModal';

const formatTimeInTZ = (date) =>
  new Intl.DateTimeFormat('es-CR', {
    timeZone: DEFAULT_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const formatDateShortInTZ = (date) =>
  new Intl.DateTimeFormat('es-CR', {
    timeZone: DEFAULT_TZ,
    day: '2-digit',
    month: 'short',
  }).format(new Date(date));

export default function ProfessionalAppointmentsPanel({ initialAppointments = [], bookingContext }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState('TODAY');
  const [loadingId, setLoadingId] = useState(null);
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptingApt, setAcceptingApt] = useState(null);
  const [followUpApt, setFollowUpApt] = useState(null);

  const updateAppointmentLocally = (appointmentId, changes) => {
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, ...changes } : appointment
      )
    );
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!confirm('¿Confirmas el cambio de estado de esta cita?')) return;

    setLoadingId(id);
    const result = await updateAppointmentStatus(id, newStatus);

    if (result.success) {
      setAppointments((current) =>
        current.map((appointment) => (appointment.id === id ? { ...appointment, status: newStatus } : appointment))
      );
    } else {
      alert(result.error || 'Error al actualizar');
    }
    setLoadingId(null);
  };

  const handleCancel = async (appointmentId, reason) => {
    const result = await cancelAppointmentByProfessional(appointmentId, reason);
    if (result?.success) {
      updateAppointmentLocally(appointmentId, { status: 'CANCELLED_BY_PRO' });
    }
    return result;
  };

  const filteredAppointments = appointments.filter((appointment) => {
    const date = new Date(appointment.date);
    if (filter === 'TODAY') return isToday(date);
    if (filter === 'UPCOMING') return isFuture(date);
    if (filter === 'PENDING') return appointment.status === 'PENDING';
    return true;
  });

  const getStatusBadge = (status) => {
    const config = {
      PENDING: { label: 'Pendiente', style: 'bg-accent-700 text-white' },
      CONFIRMED: { label: 'Confirmada', style: 'bg-brand-600 text-white' },
      COMPLETED: { label: 'Completada', style: 'bg-brand-700 text-white' },
      NO_SHOW: { label: 'Ausente', style: 'bg-accent-800 text-white' },
      CANCELLED_BY_USER: { label: 'Cancelada (P)', style: 'bg-accent-900 text-white line-through' },
      CANCELLED_BY_PRO: { label: 'Cancelada', style: 'bg-accent-900 text-white line-through' },
    };
    const current = config[status] || { label: status, style: 'bg-gray-100 text-gray-800' };
    return <span className={`rounded px-2 py-1 text-xs font-bold ${current.style}`}>{current.label}</span>;
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-2">
          {['TODAY', 'UPCOMING', 'PENDING', 'ALL'].map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                filter === value ? 'bg-white text-blue-600 shadow ring-1 ring-blue-200' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              {value === 'TODAY' ? 'Hoy' : value === 'UPCOMING' ? 'Futuras' : value === 'PENDING' ? 'Solicitudes' : 'Historial'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Nueva cita
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-6 py-3 font-semibold">Horario</th>
              <th className="px-6 py-3 font-semibold">Paciente</th>
              <th className="px-6 py-3 font-semibold">Servicio</th>
              <th className="px-6 py-3 font-semibold">Estado</th>
              <th className="px-6 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((appointment) => (
                <tr key={appointment.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-900">{formatTimeInTZ(appointment.date)}</p>
                    <p className="text-xs text-gray-500">{formatDateShortInTZ(appointment.date)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{appointment.user.name}</p>
                    <p className="text-xs text-gray-500">{appointment.user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-800">{appointment.service?.title}</p>
                    <span className="text-xs font-bold text-green-600">${Number(appointment.service?.price || 0)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1">
                      {getStatusBadge(appointment.status)}
                      {appointment.paymentStatus === "PAID" && (
                        <span className="rounded px-2 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">Pagado</span>
                      )}
                      {appointment.paymentStatus === "PARTIALLY_PAID" && (
                        <span className="rounded px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700">Depósito</span>
                      )}
                      {appointment.paymentStatus === "UNPAID" && appointment.status === "COMPLETED" && (
                        <span className="rounded px-2 py-1 text-xs font-bold bg-red-100 text-red-700">Sin pagar</span>
                      )}
                      {appointment.parentAppointmentId && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">↩ Seguimiento</span>
                      )}
                    </div>
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    {(appointment.status === 'PENDING' || appointment.status === 'CONFIRMED') && isFuture(new Date(appointment.date)) && (
                      <button
                        onClick={() => setReschedulingApt(appointment)}
                        className="rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800"
                      >
                        Reagendar
                      </button>
                    )}

                    {appointment.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setAcceptingApt(appointment)}
                          disabled={loadingId === appointment.id}
                          className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => setCancelingApt(appointment)}
                          disabled={loadingId === appointment.id}
                          className="rounded bg-accent-700 px-3 py-1 text-xs text-white hover:bg-accent-800 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )}

                    {appointment.status === 'CONFIRMED' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(appointment.id, 'COMPLETED')}
                          disabled={loadingId === appointment.id}
                          className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Completar
                        </button>
                        <button
                          onClick={() => handleStatusChange(appointment.id, 'NO_SHOW')}
                          disabled={loadingId === appointment.id}
                          className="rounded bg-accent-600 px-3 py-1 text-xs text-white hover:bg-accent-700 disabled:opacity-50"
                        >
                          Ausente
                        </button>
                        <button
                          onClick={() => setCancelingApt(appointment)}
                          disabled={loadingId === appointment.id}
                          className="rounded bg-accent-800 px-3 py-1 text-xs text-white hover:bg-accent-900 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )}

                    {appointment.status === 'COMPLETED' && (
                      <button
                        onClick={() => setFollowUpApt(appointment)}
                        className="rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800"
                      >
                        Seguimiento
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                  No hay citas en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateProfessionalAppointmentModal
          patients={bookingContext?.patients || []}
          services={bookingContext?.services || []}
          availability={bookingContext?.availability || []}
          booked={bookingContext?.booked || []}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {reschedulingApt && (
        <ProfessionalRescheduleModal
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
          onSuccess={(payload) => {
            updateAppointmentLocally(payload.id, {
              status: payload.status,
              date: payload.date,
            });
            setReschedulingApt(null);
          }}
        />
      )}

      {acceptingApt && (
        <AcceptRecurringAppointmentModal
          appointment={acceptingApt}
          onClose={() => setAcceptingApt(null)}
          onSuccess={(payload) => {
            updateAppointmentLocally(payload.id, { status: payload.status });
            setAcceptingApt(null);
          }}
        />
      )}

      {cancelingApt && (
        <CancelAppointmentModal
          appointment={cancelingApt}
          onCancel={handleCancel}
          onClose={() => setCancelingApt(null)}
          role="professional"
        />
      )}

      {followUpApt && (
        <FollowUpModal
          appointment={followUpApt}
          onClose={() => setFollowUpApt(null)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
