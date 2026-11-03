"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { createAppointmentByProfessional } from "@/actions/agenda-actions";
import NavegadorDeQuincenas from "@/components/appointments/NavegadorDeQuincenas";
import {
  appointmentIntervalMin,
  buildSlots,
  crDay,
  DIAS_POR_TANDA,
  formatDayTab,
  formatSelectedLabel,
  formatSlotTime,
} from "@/lib/appointment-slots";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export default function CreateProfessionalAppointmentModal({
  patients = [],
  services = [],
  availability = [],
  booked = [],
  professionalSlug = "",
  // Cita recién completada: el modal pasa a «próxima sesión», con su paciente
  // fijo, su servicio y el mismo día y hora de la semana siguiente sugeridos.
  previousAppointment = null,
  onClose,
  onSuccess,
}) {
  const previous = previousAppointment;
  const [patientId, setPatientId] = useState(previous?.patientId || patients[0]?.id || "");
  const [serviceId, setServiceId] = useState(() => {
    const anterior = previous?.serviceId;
    return services.some((service) => service.id === anterior) ? anterior : services[0]?.id || "";
  });
  const [desde, setDesde] = useState(() => crDay(new Date()));
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedISO, setSelectedISO] = useState("");
  const [sugerido, setSugerido] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [error, setError] = useState("");
  const [conflictMeta, setConflictMeta] = useState(null);
  const [isPending, startTransition] = useTransition();
  const { avisar } = useToast();

  const selectedService = services.find((service) => service.id === serviceId) || null;
  const days = useMemo(() => {
    const durationMin = selectedService?.durationMin ?? 60;
    return buildSlots({
      availability,
      durationMin,
      intervalMin: appointmentIntervalMin(professionalSlug, durationMin),
      booked,
      startDay: desde,
      daysAhead: DIAS_POR_TANDA,
    });
  }, [availability, booked, selectedService, professionalSlug, desde]);
  const activeDay = days[selectedDayIdx] ?? null;

  // Una sola vez, al abrir: si el mismo horario de la semana siguiente está
  // libre, queda elegido; si no, se muestra el primer día con cupos.
  useEffect(() => {
    if (!previous || sugerido) return;
    setSugerido(true);
    const objetivo = new Date(previous.date).getTime() + SEMANA_MS;
    days.forEach((dayItem, index) => {
      if (dayItem.slots.some((slot) => slot.start.getTime() === objetivo)) {
        setSelectedDayIdx(index);
        setSelectedISO(new Date(objetivo).toISOString());
      }
    });
  }, [previous, sugerido, days]);

  function handleConfirm() {
    if (!patientId || !serviceId || !selectedISO) {
      setError("Completa paciente, servicio y horario.");
      return;
    }

    setError("");
    setConflictMeta(null);
    startTransition(async () => {
      try {
        const result = await createAppointmentByProfessional({
          patientId,
          serviceId,
          startISO: selectedISO,
          recurrenceRule,
          recurrenceCount,
          parentAppointmentId: previous?.id || null,
        });
  
        if (!result?.success) {
          setError(result?.error || "No se pudo crear la cita.");
          if (result?.errorCode === "RECURRING_CONFLICT") {
            setConflictMeta({
              suggestedCalendarUrl: result?.suggestedCalendarUrl || "",
            });
          }
          return;
        }
  
        onSuccess?.(result);
        onClose();
      } catch (fallo) {
        // Antes esto se perdía como promesa rechazada: ni mensaje ni cambio.
        const mensaje = String(fallo?.message || "").trim() || "No se pudo completar la acción.";
        setError(mensaje);
        avisar(mensaje, "error");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {previous ? `Próxima sesión con ${previous.patientName}` : "Nueva cita"}
          </h2>
          <button
            onClick={onClose}
            className="text-xl font-bold leading-none text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        {previous ? (
          <div className="space-y-1 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-800">
            <p>
              La sesión quedó completada. Si ya acordaron la próxima, agéndela acá: nace
              confirmada y el paciente recibe el aviso.
            </p>
            {previous.nextLabel ? (
              <p className="font-semibold">Ya tiene agendada: {previous.nextLabel}.</p>
            ) : null}
            <p className="text-slate-600">Para varias sesiones seguidas, use «Recurrencia» más abajo.</p>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-800">Paciente</label>
            {previous ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                {previous.patientName}
              </p>
            ) : (
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
            )}
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

        <NavegadorDeQuincenas
          desde={desde}
          onChange={(nuevoDesde) => {
            // El horario ya elegido se conserva: solo cambia lo que se mira.
            setDesde(nuevoDesde);
            setSelectedDayIdx(0);
          }}
        />

        {days.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay horarios disponibles en estas dos semanas para este servicio.
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
            Horario elegido: <strong>{formatSelectedLabel(new Date(selectedISO))}</strong>{" "}
            <span className="text-slate-500">(hora de Costa Rica)</span>
          </div>
        )}

        <RecurrenceFields
          recurrenceRule={recurrenceRule}
          recurrenceCount={recurrenceCount}
          onRuleChange={setRecurrenceRule}
          onCountChange={setRecurrenceCount}
        />

        {error && (
          <div className="space-y-2 rounded-xl border border-accent-300 bg-accent-100 p-3 text-sm text-neutral-900">
            <p>{error}</p>
            {conflictMeta?.suggestedCalendarUrl && (
              <a
                href={conflictMeta.suggestedCalendarUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-semibold text-brand-700 hover:underline"
              >
                Abrir calendario del día sugerido
              </a>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            {previous ? "Ahora no" : "Cancelar"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !selectedISO || !patientId || !serviceId}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Creando..." : previous ? "Agendar próxima sesión" : "Crear cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
