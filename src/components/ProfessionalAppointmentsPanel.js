//src/components/ProfessionalAppointmentsPanel.js
'use client';

import { useState } from 'react';
import { format, isToday, isFuture, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { updateAppointmentStatus } from '@/actions/agenda-actions';

export default function ProfessionalAppointmentsPanel({ initialAppointments = [] }) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState('TODAY'); // 'TODAY', 'UPCOMING', 'PENDING', 'ALL'
  const [loadingId, setLoadingId] = useState(null); // Para mostrar spinner en el botón que se clickea

  // Función para manejar cambios de estado (Server Action)
  const handleStatusChange = async (id, newStatus) => {
    if(!confirm('¿Confirmas el cambio de estado de esta cita?')) return;
    
    setLoadingId(id);
    const res = await updateAppointmentStatus(id, newStatus);
    
    if (res.success) {
        // Actualización optimista local
        setAppointments(prev => prev.map(apt => 
            apt.id === id ? { ...apt, status: newStatus } : apt
        ));
    } else {
        alert("Error al actualizar");
    }
    setLoadingId(null);
  };

  // Lógica de Filtrado
  const filteredAppointments = appointments.filter(apt => {
    const date = new Date(apt.date);
    if (filter === 'TODAY') return isToday(date);
    if (filter === 'UPCOMING') return isFuture(date);
    if (filter === 'PENDING') return apt.status === 'PENDING';
    return true; // ALL
  });

  // Badge de Estado
  const getStatusBadge = (status) => {
    const config = {
      PENDING: { label: 'Pendiente', style: 'bg-yellow-100 text-yellow-800' },
      CONFIRMED: { label: 'Confirmada', style: 'bg-blue-100 text-blue-800' },
      COMPLETED: { label: 'Completada', style: 'bg-green-100 text-green-800' },
      NO_SHOW: { label: 'Ausente', style: 'bg-red-100 text-red-800' },
      CANCELLED_BY_USER: { label: 'Cancelada (P)', style: 'bg-gray-100 text-gray-500 line-through' },
    };
    const current = config[status] || { label: status, style: 'bg-gray-100' };
    return <span className={`px-2 py-1 rounded text-xs font-bold ${current.style}`}>{current.label}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Barra de Herramientas */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-2">
        {['TODAY', 'UPCOMING', 'PENDING', 'ALL'].map(f => (
            <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === f ? 'bg-white text-blue-600 shadow ring-1 ring-blue-100' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {f === 'TODAY' ? 'Hoy' : f === 'UPCOMING' ? 'Futuras' : f === 'PENDING' ? 'Solicitudes' : 'Historial'}
            </button>
        ))}
      </div>

      {/* Tabla de Citas */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="text-gray-500 text-xs uppercase bg-gray-50 border-b">
                    <th className="px-6 py-3 font-semibold">Horario</th>
                    <th className="px-6 py-3 font-semibold">Paciente</th>
                    <th className="px-6 py-3 font-semibold">Servicio</th>
                    <th className="px-6 py-3 font-semibold">Estado</th>
                    <th className="px-6 py-3 font-semibold text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredAppointments.length > 0 ? (
                    filteredAppointments.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                                <p className="font-bold text-gray-900">{format(new Date(apt.date), 'HH:mm', { locale: es })}</p>
                                <p className="text-xs text-gray-500">{format(new Date(apt.date), 'dd MMM', { locale: es })}</p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{apt.user.name}</p>
                                <p className="text-xs text-gray-500">{apt.user.email}</p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-sm text-gray-800">{apt.service?.title}</p>
                                <span className="text-xs text-green-600 font-bold">${Number(apt.service?.price)}</span>
                            </td>
                            <td className="px-6 py-4">
                                {getStatusBadge(apt.status)}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                                {/* Lógica de Botones según estado */}
                                {apt.status === 'PENDING' && (
                                    <button 
                                        onClick={() => handleStatusChange(apt.id, 'CONFIRMED')}
                                        disabled={loadingId === apt.id}
                                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Aceptar
                                    </button>
                                )}
                                
                                {apt.status === 'CONFIRMED' && (
                                    <>
                                        <button 
                                            onClick={() => handleStatusChange(apt.id, 'COMPLETED')}
                                            disabled={loadingId === apt.id}
                                            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Completar
                                        </button>
                                        <button 
                                            onClick={() => handleStatusChange(apt.id, 'NO_SHOW')}
                                            disabled={loadingId === apt.id}
                                            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 disabled:opacity-50"
                                        >
                                            Ausente
                                        </button>
                                    </>
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
    </div>
  );
}