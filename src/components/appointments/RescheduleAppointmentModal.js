"use client";
import { useState, useEffect, useMemo, useTransition } from "react";
import { getAppointmentRescheduleData, rescheduleAppointmentByPatient } from "@/actions/patient-booking-actions";

// --- Helpers copiados de ProfessionalCalendarBooking ---
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

function formatDayTab(date) {
  return new Intl.DateTimeFormat("es-CR", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatSlotTime(date) {
  return new Intl.DateTimeFormat("es-CR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatSelectedLabel(date) {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default function RescheduleAppointmentModal({ appointment, onClose }) {
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedISO, setSelectedISO] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAppointmentRescheduleData(appointment.id).then((res) => {
      if (res.error) {
        setDataError(res.error);
      } else {
        setData(res);
      }
      setLoadingData(false);
    });
  }, [appointment.id]);

  const days = useMemo(() => {
    if (!data) return [];
    return buildSlots({
      availability: data.availability,
      durationMin: data.durationMin,
      booked: data.booked,
    });
  }, [data]);

  const activeDay = days[selectedDayIdx] ?? null;

  function handleConfirm() {
    if (!selectedISO) {
      setError("Selecciona un horario.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await rescheduleAppointmentByPatient(appointment.id, selectedISO);
      if (result?.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Reagendar cita</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">×</button>
        </div>

        <p className="text-sm text-slate-600">
          Selecciona un nuevo horario para tu cita de{" "}
          <strong>{appointment.service?.title || "consulta"}</strong>.
          La cita quedará en estado <strong>Pendiente</strong> hasta que el profesional la confirme.
        </p>

        {loadingData && (
          <div className="text-center py-8 text-slate-500 text-sm">Cargando disponibilidad...</div>
        )}

        {dataError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{dataError}</div>
        )}

        {!loadingData && !dataError && days.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No hay horarios disponibles en los próximos 14 días.
          </div>
        )}

        {!loadingData && !dataError && days.length > 0 && (
          <>
            {/* Tabs de días */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedDayIdx(i); setSelectedISO(""); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    selectedDayIdx === i
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {formatDayTab(d.day)}
                </button>
              ))}
            </div>

            {/* Slots del día seleccionado */}
            {activeDay && (
              <div className="flex flex-wrap gap-2">
                {activeDay.slots.map((slot, i) => {
                  const iso = slot.start.toISOString();
                  const isSelected = selectedISO === iso;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedISO(iso)}
                      className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-slate-300 text-slate-800 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                      }`}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Horario seleccionado */}
            {selectedISO && (
              <div className="rounded-xl border-l-4 border-blue-600 bg-slate-50 px-4 py-2 text-sm text-slate-800">
                Nuevo horario: <strong>{formatSelectedLabel(new Date(selectedISO))}</strong>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !selectedISO}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Confirmar reagendamiento"}
          </button>
        </div>
      </div>
    </div>
  );
}
