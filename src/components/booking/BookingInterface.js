"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getAvailableSlots, requestAppointment } from "@/actions/booking-actions";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";
import Toast from "@/components/ui/Toast";

export default function BookingInterface({ professionalId, servicePrice, serviceTitle, serviceId }) {
  const router = useRouter();
  const hasValidPrice = Number.isFinite(Number(servicePrice)) && Number(servicePrice) > 0;

  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [conflict, setConflict] = useState(null);
  const [conflictSlots, setConflictSlots] = useState([]);
  const [loadingConflictSlots, setLoadingConflictSlots] = useState(false);
  const [altSlot, setAltSlot] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      setSlots([]);
      setSelectedSlot(null);

      const result = await getAvailableSlots(professionalId, selectedDate);
      if (result.success) setSlots(result.slots);
      setLoading(false);
    };

    if (selectedDate) fetchSlots();
  }, [selectedDate, professionalId]);

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
    } else if (result.errorCode === "UNAUTHENTICATED") {
      const callbackUrl = encodeURIComponent(`/agendar/${professionalId}`);
      router.push(`/ingresar?callbackUrl=${callbackUrl}`);
    } else if (result.conflictInfo) {
      setConflict(result.conflictInfo);
    } else {
      setToast({ message: result.error || "No se pudo procesar la reserva.", type: "error" });
      if (result.error && result.error.includes("ocup")) setSelectedSlot(null);
    }

    setIsBooking(false);
  }

  const conflictDateLabel = conflict
    ? format(new Date(`${conflict.dateString}T00:00:00`), "EEEE d 'de' MMMM", { locale: es })
    : "";

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 shadow-card">
        <div className="bg-brand-900 p-6 text-white">
          <h3 className="text-lg font-semibold text-white/90">Agendar cita</h3>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold">{serviceTitle}</p>
              <p className="text-sm text-white/75">Duración: 60 min</p>
            </div>
            <div className="text-right">
              <span className="block text-xl font-bold">
                {hasValidPrice ? `₡${Number(servicePrice).toLocaleString("es-CR")}` : "Valor no disponible"}
              </span>
              <span className="mt-1 block text-xs text-white/75">
                Valor real en colones según la tarifa aprobada del profesional.
              </span>
            </div>
          </div>
        </div>

        {conflict && (
          <div className="border-b border-accent-300 bg-accent-50 p-5">
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 text-xl text-accent-900">!</span>
              <div>
                <p className="font-semibold text-accent-950">Conflicto de horario detectado</p>
                <p className="mt-1 text-sm text-accent-900">
                  {conflict.label} Seleccione un horario alternativo para la sesión del{" "}
                  <strong className="capitalize">{conflictDateLabel}</strong>.
                </p>
              </div>
            </div>

            {loadingConflictSlots ? (
              <div className="flex items-center gap-2 py-4 text-sm text-accent-900">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-800 border-t-transparent"></span>
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
                          ? "scale-105 border-accent-800 bg-accent-800 text-white shadow-md"
                          : "border-accent-400 bg-white text-accent-950 hover:bg-accent-100"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => altSlot && submitBooking(altSlot)}
                    disabled={!altSlot || isBooking}
                    className="flex-1 rounded-xl bg-accent-800 py-2.5 text-sm font-bold text-white hover:bg-accent-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBooking
                      ? "Procesando..."
                      : altSlot
                        ? `Confirmar ${altSlot} para esa sesión`
                        : "Seleccione un horario"}
                  </button>
                  <button
                    onClick={() => {
                      setConflict(null);
                      setConflictSlots([]);
                      setAltSlot(null);
                    }}
                    className="rounded-xl border border-neutral-400 bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-neutral-200"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-accent-300 bg-white py-5 text-center">
                <p className="text-sm text-accent-900">No hay horarios disponibles ese día.</p>
                <p className="mt-1 text-xs text-accent-800">Elija una fecha de inicio diferente.</p>
                <button
                  onClick={() => {
                    setConflict(null);
                    setConflictSlots([]);
                    setAltSlot(null);
                  }}
                  className="mt-3 text-sm font-semibold text-brand-800 hover:text-brand-900"
                >
                  Volver al formulario
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-brand-900">1. Seleccione el día</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setConflict(null);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-neutral-950 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-300"
            />
            <p className="mt-2 text-xs capitalize text-neutral-700">
              {selectedDate &&
                format(new Date(`${selectedDate}T00:00:00`), "EEEE d 'de' MMMM, yyyy", { locale: es })}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-brand-900">2. Horarios disponibles</label>
            <p className="mb-3 text-xs text-neutral-700">
              Todos los horarios están expresados en hora de Costa Rica; si está en otro huso
              horario, téngalo en cuenta.
            </p>

            {loading ? (
              <div className="flex flex-col items-center py-8 text-center text-neutral-700">
                <span className="mb-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent"></span>
                Buscando espacios libres...
              </div>
            ) : slots.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {slots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedSlot(time)}
                    className={`rounded-xl border px-1 py-2 text-sm font-medium transition-all ${
                      selectedSlot === time
                        ? "scale-105 border-brand-700 bg-brand-700 text-white shadow-md"
                        : "border-neutral-300 bg-white text-neutral-950 hover:border-brand-400 hover:bg-brand-50"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-100 py-8 text-center">
                <p className="text-sm text-neutral-800">No hay horarios disponibles.</p>
                <p className="mt-1 text-xs text-neutral-700">Pruebe seleccionando otro día.</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-brand-900">3. Repetición de la cita</label>
            <RecurrenceFields
              recurrenceRule={recurrenceRule}
              recurrenceCount={recurrenceCount}
              onRuleChange={setRecurrenceRule}
              onCountChange={setRecurrenceCount}
              compact
            />
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <button
              disabled={!selectedSlot || isBooking || !!conflict}
              onClick={() => selectedSlot && submitBooking(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBooking ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Procesando...
                </>
              ) : selectedSlot ? (
                `Solicitar reserva (${selectedSlot})`
              ) : (
                "Seleccione un horario"
              )}
            </button>

            {selectedSlot && !conflict && (
              <p className="mt-3 text-center text-xs text-neutral-700">
                La cita quedará pendiente de confirmación por el profesional.
              </p>
            )}
          </div>
        </div>
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </>
  );
}
