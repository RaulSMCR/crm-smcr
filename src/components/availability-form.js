'use client'

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAvailability } from '@/actions/availability-actions';

const DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' }, // 0 suele ser Domingo en JS/Prisma standard
];

export default function AvailabilityForm({ initialAvailability = [] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(null);

  // Inicializar estado basado en datos de DB o defaults
  const [schedule, setSchedule] = useState(() => {
    const map = {};
    // Pre-llenar defaults (inactivos)
    DAYS.forEach(d => {
      map[d.id] = { active: false, start: '09:00', end: '17:00' };
    });
    // Sobrescribir con datos guardados
    initialAvailability.forEach(item => {
      if (map[item.dayOfWeek]) {
        map[item.dayOfWeek] = { 
          active: true, 
          start: item.startTime, 
          end: item.endTime 
        };
      }
    });
    return map;
  });

  const handleToggle = (dayId) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], active: !prev[dayId].active }
    }));
  };

  const handleChangeTime = (dayId, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value }
    }));
  };

  const onSave = async () => {
    setMessage(null);
    
    // Transformar estado al formato que espera la Server Action
    const payload = Object.entries(schedule)
      .filter(([_, val]) => val.active)
      .map(([dayId, val]) => ({
        dayOfWeek: parseInt(dayId),
        startTime: val.start,
        endTime: val.end
      }));

    startTransition(async () => {
      const result = await updateAvailability(payload);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: '¡Horarios guardados correctamente!' });
        router.refresh(); // Refresca los datos del servidor
      }
    });
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4">Configurar Horarios Semanales</h2>
      
      {message && (
        <div className={`p-3 mb-4 rounded text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {DAYS.map((day) => {
          const config = schedule[day.id];
          return (
            <div key={day.id} className="flex items-center gap-4 py-2 border-b last:border-0">
              
              {/* Checkbox Día */}
              <div className="w-32 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`day-${day.id}`}
                  checked={config.active}
                  onChange={() => handleToggle(day.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor={`day-${day.id}`} className={`font-medium cursor-pointer ${config.active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {day.label}
                </label>
              </div>

              {/* Selectores de Hora (Solo visibles si activo) */}
              {config.active ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={config.start}
                    onChange={(e) => handleChangeTime(day.id, 'start', e.target.value)}
                    className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-gray-400 text-sm">a</span>
                  <input
                    type="time"
                    value={config.end}
                    onChange={(e) => handleChangeTime(day.id, 'end', e.target.value)}
                    className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">No disponible</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onSave}
          disabled={isPending}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {isPending ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}