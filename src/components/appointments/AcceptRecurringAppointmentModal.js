"use client";

import { useState, useTransition } from "react";
import { confirmAppointmentByProfessional } from "@/actions/agenda-actions";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";

export default function AcceptRecurringAppointmentModal({ appointment, onClose, onSuccess }) {
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [error, setError] = useState("");
  const [conflictMeta, setConflictMeta] = useState(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError("");
    setConflictMeta(null);
    startTransition(async () => {
      const result = await confirmAppointmentByProfessional(
        appointment.id,
        recurrenceRule,
        recurrenceCount
      );

      if (!result?.success) {
        setError(result?.error || "No se pudo aceptar la cita.");
        if (result?.errorCode === "RECURRING_CONFLICT") {
          setConflictMeta({
            suggestedCalendarUrl: result?.suggestedCalendarUrl || "",
            conflictLabel: result?.conflictLabel || "",
          });
        }
        return;
      }

      onSuccess?.({
        id: appointment.id,
        status: "CONFIRMED",
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Aceptar cita</h2>
          <button onClick={onClose} className="text-xl font-bold leading-none text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Puedes confirmar esta cita normalmente o convertirla en una serie recurrente para{" "}
          <strong>{appointment.user?.name}</strong>.
        </p>

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
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
