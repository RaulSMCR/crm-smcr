// src/components/booking/ProfessionalCalendarBooking.js
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAppointmentForPatient } from "@/actions/patient-booking-actions";

function parseHHMM(s) {
  const [h, m] = String(s || "00:00").split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function buildSlots({ availability, durationMin, booked, daysAhead = 14 }) {
  const now = new Date();
  const bookedIntervals = booked.map((x) => ({
    start: new Date(x.startISO).getTime(),
    end: new Date(x.endISO).getTime(),
  }));

  const byDow = new Map();
  for (const a of availability) {
    const list = byDow.get(a.dayOfWeek) || [];
    list.push(a);
    byDow.set(a.dayOfWeek, list);
  }

  const days = [];
  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + d);

    const dow = day.getDay();
    const windows = byDow.get(dow) || [];
    const slots = [];

    for (const w of windows) {
      const startMin = parseHHMM(w.startTime);
      const endMin = parseHHMM(w.endTime);

      for (let t = startMin; t + durationMin <= endMin; t += durationMin) {
        const start = new Date(day);
        start.setMinutes(t, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + durationMin);

        if (start <= now) continue;

        const sMs = start.getTime();
        const eMs = end.getTime();

        const isTaken = bookedIntervals.some((b) => overlaps(sMs, eMs, b.start, b.end));
        if (!isTaken) slots.push({ start, end });
      }
    }

    if (slots.length > 0) days.push({ day, slots });
  }

  return days;
}

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
      });

      if (res?.success) {
        router.push("/panel/paciente?created=1");
        router.refresh();
      } else {
        setMsg({ type: "error", text: res?.error || "No se pudo agendar. Intenta nuevamente." });
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
            {professionalImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={professionalImage} alt={professionalName} className="h-full w-full object-cover" />
            ) : (
              <span className="font-semibold text-slate-700">{professionalName?.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">{professionalName}</div>
            <div className="text-sm text-slate-600">Selecciona un horario disponible</div>
          </div>
        </div>

        {msg.text && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {msg.text}
          </div>
        )}

        {days.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
            No hay horarios disponibles en los próximos 14 días.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {days.map(({ day, slots }) => (
              <div key={day.toISOString()}>
                <div className="text-sm font-semibold text-slate-800">
                  {day.toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const iso = s.start.toISOString();
                    const isSel = selectedISO === iso;

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedISO(iso)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          isSel
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-slate-200 hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        {s.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 h-fit">
        <h3 className="text-lg font-semibold text-slate-900">Confirmación</h3>

        <div className="mt-3 text-sm text-slate-700">
          Duración: <b>{durationMin} min</b>
        </div>

        <div className="mt-3 text-sm text-slate-700">
          Horario seleccionado:{" "}
          <b>{selectedISO ? new Date(selectedISO).toLocaleString() : "—"}</b>
        </div>

        <button
          type="button"
          disabled={!selectedISO || isPending}
          onClick={onConfirm}
          className="mt-5 w-full rounded-xl bg-blue-600 text-white px-4 py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Agendando..." : "Confirmar cita"}
        </button>

        <p className="mt-3 text-xs text-slate-500">
          Si el horario deja de estar disponible, se te notificará al confirmar.
        </p>
      </div>
    </div>
  );
}
