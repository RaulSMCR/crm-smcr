'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailableSlots, requestAppointment } from '@/actions/booking-actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RECURRENCE_RULES } from '@/lib/appointment-recurrence';
import RecurrenceFields from '@/components/appointments/RecurrenceFields';

export default function BookingInterface({ professionalId, servicePrice, serviceTitle, serviceId }) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setSlots([]);
      setSelectedSlot(null);

      const result = await getAvailableSlots(professionalId, selectedDate);

      if (result.success) {
        setSlots(result.slots);
      }
      setLoading(false);
    };

    if (selectedDate) fetchSlots();
  }, [selectedDate, professionalId]);

  const handleBooking = async () => {
    if (!selectedSlot) return;
    setIsBooking(true);

    const result = await requestAppointment(
      professionalId,
      selectedDate,
      selectedSlot,
      serviceId,
      recurrenceRule,
      recurrenceCount
    );

    if (result.success) {
      router.push(`/panel/paciente?new_appointment=true&series=${result.createdCount || 1}`);
    } else if (result.errorCode === 'UNAUTHENTICATED') {
      const callbackUrl = encodeURIComponent(`/agendar/${professionalId}`);
      router.push(`/ingresar?callbackUrl=${callbackUrl}`);
    } else {
      alert(`Error: ${result.error}`);
      if (result.error && result.error.includes('ocup')) {
        setSelectedSlot(null);
      }
    }

    setIsBooking(false);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
      <div className="bg-gray-900 p-6 text-white">
        <h3 className="text-lg font-semibold opacity-90">Agendar cita</h3>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{serviceTitle}</p>
            <p className="text-sm opacity-70">DuraciÃ³n: 60 min</p>
          </div>
          <div className="text-right">
            <span className="block text-xl font-bold">â‚¡{Number(servicePrice).toLocaleString('es-CR')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">1. Seleccione el dia</label>
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs capitalize text-gray-500">
            {selectedDate && format(new Date(`${selectedDate}T00:00:00`), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">2. Horarios disponibles</label>
          <p className="mb-3 text-xs text-gray-500">
            Todos los horarios estÃ¡n expresados en hora de Costa Rica; si estÃ¡s en otro huso horario, tenlo en cuenta.
          </p>

          {loading ? (
            <div className="flex flex-col items-center py-8 text-center text-gray-400 animate-pulse">
              <span className="mb-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
              Buscando espacios libres...
            </div>
          ) : slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedSlot(time)}
                  className={`rounded-lg border px-1 py-2 text-sm font-medium transition-all ${
                    selectedSlot === time
                      ? 'scale-105 border-blue-600 bg-blue-600 text-white shadow-md'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-8 text-center">
              <p className="text-sm text-gray-500">No hay horarios disponibles.</p>
              <p className="mt-1 text-xs text-gray-400">Prueba seleccionando otro dÃ­a.</p>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">3. RepeticiÃ³n de la cita</label>
          <RecurrenceFields
            recurrenceRule={recurrenceRule}
            recurrenceCount={recurrenceCount}
            onRuleChange={setRecurrenceRule}
            onCountChange={setRecurrenceCount}
            compact
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <button
            disabled={!selectedSlot || isBooking}
            onClick={handleBooking}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-green-700 hover:shadow-green-900/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBooking ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Procesando...
              </>
            ) : selectedSlot ? (
              `Solicitar reserva (${selectedSlot})`
            ) : (
              'Seleccione un horario'
            )}
          </button>

          {selectedSlot && (
            <p className="mt-3 text-center text-xs text-gray-500">
              La cita quedarÃ¡ pendiente de confirmaciÃ³n por el profesional.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

