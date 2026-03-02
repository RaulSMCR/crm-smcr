"use client";

import { useMemo, useState, useTransition } from "react";
import { createAppointmentByProfessional } from "@/actions/agenda-actions";
import {
  buildSlots,
  formatDayTab,
  formatSelectedLabel,
  formatSlotTime,
} from "@/lib/appointment-slots";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";

export default function CreateProfessionalAppointmentModal({
  patients = [],
  services = [],
  availability = [],
  booked = [],
  onClose,
  onSuccess,
}) {
  const [patientId, setPatientId] = useState(patients[0]?.id || "");
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedISO, setSelectedISO] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedService = services.find((service) => service.id === serviceId) || null;
  const days = useMemo(() => {
    return buildSlots({
      availability,
      durationMin: selectedService?.durationMin ?? 60,
      booked,
    });
  }, [availability, booked, selectedService]);
  const activeDay = days[selectedDayIdx] ?? null;

  function handleConfirm() {
    if (!patientId || !serviceId || !selectedISO) {
      setError("Completa paciente, servicio y horario.");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await createAppointmentByProfessional({
        patientId,
        serviceId,
        startISO: selectedISO,
        recurrenceRule,
        recurrenceCount,
      });

      if (!result?.success) {
        setError(result?.error || "No se pudo crear la cita.");
        return;
      }

      onSuccess?.();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Nueva cita</h2>
          <button
            onClick={onClose}
            className="text-xl font-bold leading-none text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Paciente</label>
            <select
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} · {patient.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Servicio</label>
            <select
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setSelectedDayIdx(0);
                setSelectedISO("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title} · {service.durationMin} min
                </option>
              ))}
            </select>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay horarios disponibles en los próximos 14 días para este servicio.
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((dayItem, index) => (
                <button
                  key={dayItem.day.toISOString()}
                  onClick={() => {
                    setSelectedDayIdx(index);
                    setSelectedISO("");
                  }}
                  className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedDayIdx === index
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {formatDayTab(dayItem.day)}
                </button>
              ))}
            </div>

            {activeDay && (
              <div className="flex flex-wrap gap-2">
                {activeDay.slots.map((slot) => {
                  const iso = slot.start.toISOString();
                  const isSelected = selectedISO === iso;

                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedISO(iso)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 text-slate-800 hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                      }`}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {selectedISO && (
          <div className="rounded-xl border-l-4 border-blue-600 bg-slate-50 px-4 py-2 text-sm text-slate-800">
            Horario elegido: <strong>{formatSelectedLabel(new Date(selectedISO))}</strong>
          </div>
        )}

        <RecurrenceFields
          recurrenceRule={recurrenceRule}
          recurrenceCount={recurrenceCount}
          onRuleChange={setRecurrenceRule}
          onCountChange={setRecurrenceCount}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !selectedISO || !patientId || !serviceId}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Creando..." : "Crear cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
