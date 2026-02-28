"use client";
import { useState } from "react";

export default function CancelAppointmentModal({ appointment, onCancel, onClose }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hoursUntil = (new Date(appointment.date) - new Date()) / (1000 * 60 * 60);
  const isLateCancel = hoursUntil < 24;

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Por favor indica el motivo de cancelación.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await onCancel(appointment.id, reason);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Cancelar cita</h2>

        {isLateCancel && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p><strong>⚠️ Cancelación con menos de 24 horas de antelación</strong></p>
            <p className="mt-1">Según nuestra política, las cancelaciones con menos de 24 horas
            de anticipación pueden estar sujetas a penalización.</p>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-700">
            Motivo de cancelación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Por favor describe el motivo..."
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Cancelando..." : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}
