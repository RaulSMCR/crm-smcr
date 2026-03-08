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

  // Estado de conflicto en recurrencia
  const [conflict, setConflict] = useState(null); // { dateString, label, occurrenceIndex }
  const [conflictSlots, setConflictSlots] = useState([]);
  const [loadingConflictSlots, setLoadingConflictSlots] = useState(false);
  const [altSlot, setAltSlot] = useState(null);

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

  // Cuando se detecta conflicto, carga slots para esa fecha
  useEffect(() => {
    if (!conflict) return;

    const fetchConflictSlots = async () => {
      setLoadingConflictSlots(true);
      setAltSlot(null);
      const result = await getAvailableSlots(professionalId, conflict.dateString);
      setConflictSlots(result.success ? result.slots : []);
      setLoadingConflictSlots(false);
    };

    fetchConflictSlots();
  }, [conflict, professionalId]);

  async function submitBooking(timeOverride) {
    setIsBooking(true);

    const result = await requestAppointment(
      professionalId,
      selectedDate,
      timeOverride || selectedSlot,
      serviceId,
      recurrenceRule,
      recurrenceCount
    );

    if (result.success) {
      setConflict(null);
      router.push(`/panel/paciente?new_appointment=true&series=${result.createdCount || 1}`);
    } else if (result.errorCode === 'UNAUTHENTICATED') {
      const callbackUrl = encodeURIComponent(`/agendar/${professionalId}`);
      router.push(`/ingresar?callbackUrl=${callbackUrl}`);
    } else if (result.conflictInfo) {
      setConflict(result.conflictInfo);
    } else {
      alert(`Error: ${result.error}`);
      if (result.error && result.error.includes('ocup')) setSelectedSlot(null);
    }

    setIsBooking(false);
  }

  function handleBooking() {
    if (!selectedSlot) return;
    submitBooking(null);
  }

  function handleConflictRetry() {
    if (!altSlot) return;
    setConflict(null);
    setConflictSlots([]);
    submitBooking(altSlot);
  }

  function handleDismissConflict() {
    setConflict(null);
    setConflictSlots([]);
    setAltSlot(null);
  }

  const conflictDateLabel = conflict
    ? format(new Date(`${conflict.dateString}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })
    : '';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
      <div className="bg-gray-900 p-6 text-white">
        <h3 className="text-lg font-semibold opacity-90">Agendar cita</h3>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold">{serviceTitle}</p>
            <p className="text-sm opacity-70">Duración: 60 min</p>
          </div>
          <div className="text-right">
            <span className="block text-xl font-bold">₡{Number(servicePrice).toLocaleString('es-CR')}</span>
          </div>
        </div>
      </div>

      {/* Panel de resolución de conflicto */}
      {conflict && (
        <div className="border-b border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="mt-0.5 text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-900">Conflicto de horario detectado</p>
              <p className="mt-1 text-sm text-amber-800">
                {conflict.label} Seleccione un horario alternativo para la sesión del{' '}
                <strong className="capitalize">{conflictDateLabel}</strong>:
              </p>
            </div>
          </div>

          {loadingConflictSlots ? (
            <div className="flex items-center gap-2 py-4 text-sm text-amber-700">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600 border-t-transparent"></span>
              Buscando horarios disponibles...
            </div>
          ) : conflictSlots.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {conflictSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setAltSlot(time)}
                    className={`rounded-lg border px-1 py-2 text-sm font-medium transition-all ${
                      altSlot === time
                        ? 'scale-105 border-amber-600 bg-amber-600 text-white shadow-md'
                        : 'border-amber-300 bg-white text-amber-800 hover:border-amber-500 hover:bg-amber-100'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleConflictRetry}
                  disabled={!altSlot || isBooking}
                  className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBooking ? 'Procesando...' : altSlot ? `Confirmar ${altSlot} para esa sesión` : 'Seleccione un horario'}
                </button>
                <button
                  onClick={handleDismissConflict}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-amber-300 bg-white py-5 text-center">
              <p className="text-sm text-amber-700">No hay horarios disponibles ese día.</p>
              <p className="mt-1 text-xs text-amber-600">Elija una fecha de inicio diferente.</p>
              <button
                onClick={handleDismissConflict}
                className="mt-3 text-sm font-medium text-amber-800 underline"
              >
                Volver al formulario
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">1. Seleccione el día</label>
          <input
            type="date"
            value={selectedDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setConflict(null);
            }}
            className="w-full rounded-lg border border-gray-300 p-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-2 text-xs capitalize text-gray-500">
            {selectedDate && format(new Date(`${selectedDate}T00:00:00`), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">2. Horarios disponibles</label>
          <p className="mb-3 text-xs text-gray-500">
            Todos los horarios están expresados en hora de Costa Rica; si está en otro huso horario, téngalo en cuenta.
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
              <p className="mt-1 text-xs text-gray-400">Pruebe seleccionando otro día.</p>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">3. Repetición de la cita</label>
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
            disabled={!selectedSlot || isBooking || !!conflict}
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

          {selectedSlot && !conflict && (
            <p className="mt-3 text-center text-xs text-gray-500">
              La cita quedará pendiente de confirmación por el profesional.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
