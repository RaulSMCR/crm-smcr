"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getFollowUpScheduleData, createFollowUpAppointment } from "@/actions/agenda-actions";
import {
  buildSlots,
  formatDayTab,
  formatSelectedLabel,
  formatSlotTime,
} from "@/lib/appointment-slots";

export default function FollowUpModal({ appointment, onClose, onSuccess }) {
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedISO, setSelectedISO] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    getFollowUpScheduleData(appointment.id).then((result) => {
      if (!mounted) return;

      if (result.error) {
        setDataError(result.error);
      } else {
        setData(result);
      }
      setLoadingData(false);
    });

    return () => {
      mounted = false;
    };
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
      setError("Seleccione un horario.");
      return;
    }

    setError("");
    startTransition(async () => {
      const result = await createFollowUpAppointment(appointment.id, selectedISO);

      if (!result?.success) {
        setError(result?.error || "No se pudo agendar el seguimiento.");
        return;
      }

      onSuccess?.();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Agendar cita de seguimiento</h2>
          <button
            onClick={onClose}
            className="text-xl font-bold leading-none text-slate-400 hover:text-slate-600"
          >
            Ã—
          </button>
        </div>

        {data && (
          <p className="text-sm text-slate-600">
            Se agendara una cita de seguimiento para{" "}
            <strong>{data.patientName}</strong> â€”{" "}
            <strong>{data.serviceName}</strong>.
          </p>
        )}

        {loadingData && (
          <div className="py-8 text-center text-sm text-slate-500">Cargando disponibilidad...</div>
        )}

        {dataError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {dataError}
          </div>
        )}

        {!loadingData && !dataError && days.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            No hay horarios disponibles en los prÃ³ximos 14 dÃ­as.
          </div>
        )}

        {!loadingData && !dataError && days.length > 0 && (
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
                      ? "border-indigo-600 bg-indigo-600 text-white"
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
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 text-slate-800 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white"
                      }`}
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            )}

            {selectedISO && (
              <div className="rounded-xl border-l-4 border-indigo-600 bg-slate-50 px-4 py-2 text-sm text-slate-800">
                Horario seleccionado: <strong>{formatSelectedLabel(new Date(selectedISO))}</strong>
              </div>
            )}
          </>
        )}

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
            disabled={isPending || !selectedISO}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isPending ? "Agendando..." : "Agendar seguimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

