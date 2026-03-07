"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAppointmentForPatient } from "@/actions/patient-booking-actions";
import { buildSlots } from "@/lib/appointment-slots";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";

export default function ProfessionalCalendarBooking({
  serviceId,
  professionalId,
  professionalName,
  professionalImage,
  durationMin,
  availability,
  booked,
}) {
  const router = useRouter();
  const [selectedISO, setSelectedISO] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const days = useMemo(
    () => buildSlots({ availability, durationMin, booked, daysAhead: 14 }),
    [availability, durationMin, booked]
  );

  const onConfirm = () => {
    if (!selectedISO) return;
    setMsg({ type: "", text: "" });

    startTransition(async () => {
      const res = await createAppointmentForPatient({
        professionalId,
        serviceId,
        startISO: selectedISO,
        recurrenceRule,
        recurrenceCount,
      });

      if (res?.success) {
        router.push(`/panel/paciente?created=1&series=${res.createdCount || 1}`);
        router.refresh();
      } else {
        setMsg({ type: "error", text: res?.error || "No se pudo agendar en este intento. Por favor, intentelo nuevamente." });
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/agendar/${professionalId}${serviceId ? `?serviceId=${serviceId}` : ""}`}
            className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-blue-50"
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              {professionalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={professionalImage} alt={professionalName} className="h-full w-full object-cover" />
              ) : (
                <span className="font-semibold text-slate-700">{professionalName?.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">{professionalName}</div>
              <div className="text-sm text-slate-600">Ver perfil</div>
            </div>
          </Link>
          <div className="text-sm text-slate-600">Seleccione un horario disponible</div>
        </div>

        {msg.text && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {msg.text}
          </div>
        )}

        {days.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay horarios disponibles en los prÃ³ximos 14 dÃ­as.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {days.map(({ day, slots }) => (
              <div key={day.toISOString()}>
                <div className="text-sm font-semibold text-slate-800">
                  {day.toLocaleDateString("es-CR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const iso = slot.start.toISOString();
                    const isSelected = selectedISO === iso;

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedISO(iso)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-slate-200 text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {slot.start.toLocaleTimeString("es-CR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">ConfirmaciÃ³n</h3>

        <div className="mt-3 text-sm text-slate-700">
          DuraciÃ³n: <b>{durationMin} min</b>
        </div>

        <div className="mt-3 text-sm text-slate-700">
          Horario seleccionado:{" "}
          <b>{selectedISO ? new Date(selectedISO).toLocaleString("es-CR") : "â€”"}</b>
        </div>

        <RecurrenceFields
          recurrenceRule={recurrenceRule}
          recurrenceCount={recurrenceCount}
          onRuleChange={setRecurrenceRule}
          onCountChange={setRecurrenceCount}
        />

        <button
          type="button"
          disabled={!selectedISO || isPending}
          onClick={onConfirm}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Agendando..." : "Confirmar cita"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Si activas recurrencia, se crearÃ¡n varias citas iguales dentro de la serie.
        </p>
      </div>
    </div>
  );
}

