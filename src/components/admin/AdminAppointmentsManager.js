"use client";

import { Fragment, useState, useTransition } from "react";
import { adminUpdateAppointmentStatus, adminRescheduleAppointment } from "@/actions/admin-appointments-actions";

const STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED_BY_USER",
  "CANCELLED_BY_PRO",
];

const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  NO_SHOW: "No asistió",
  CANCELLED_BY_USER: "Cancelada por paciente",
  CANCELLED_BY_PRO: "Cancelada por profesional",
};

const CANCEL_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

const CANCELED_BY_BADGE = {
  PATIENT: "bg-blue-50 text-blue-800 border-blue-200",
  PROFESSIONAL: "bg-orange-50 text-orange-800 border-orange-200",
  ADMIN: "bg-slate-50 text-slate-800 border-slate-200",
};

const CANCELED_BY_LABELS = {
  PATIENT: "Paciente",
  PROFESSIONAL: "Profesional",
  ADMIN: "Admin",
};

function toDatetimeLocal(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calcEndTime(datetimeLocal, durationMin) {
  if (!datetimeLocal || !durationMin) return null;
  const end = new Date(new Date(datetimeLocal).getTime() + durationMin * 60000);
  if (isNaN(end.getTime())) return null;
  return end.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminAppointmentsManager({ appointments = [] }) {
  const [rows, setRows] = useState(appointments);
  const [isPending, startTransition] = useTransition();

  // Cancel state
  const [pendingCancel, setPendingCancel] = useState(null); // { id, status }
  const [cancelReason, setCancelReason] = useState("");

  // Reschedule state
  const [pendingReschedule, setPendingReschedule] = useState(null); // { id, durationMin }
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");

  // ── Cancel handlers ──────────────────────────────────────────────
  const handleStatusChange = (appointmentId, nextStatus) => {
    if (CANCEL_STATUSES.has(nextStatus)) {
      setPendingReschedule(null);
      setPendingCancel({ id: appointmentId, status: nextStatus });
      setCancelReason("");
      return;
    }
    applyStatusChange(appointmentId, nextStatus, null);
  };

  const applyStatusChange = (appointmentId, nextStatus, reason) => {
    startTransition(async () => {
      const result = await adminUpdateAppointmentStatus(appointmentId, nextStatus, reason);
      if (!result?.success) {
        alert(result?.error || "No se pudo actualizar la cita.");
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === appointmentId
            ? {
                ...row,
                status: nextStatus,
                cancelReason: reason || null,
                canceledBy: reason ? "ADMIN" : null,
                canceledAt: reason ? new Date().toISOString() : null,
              }
            : row
        )
      );
      setPendingCancel(null);
      setCancelReason("");
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim() || !pendingCancel) return;
    applyStatusChange(pendingCancel.id, pendingCancel.status, cancelReason.trim());
  };

  // ── Reschedule handlers ──────────────────────────────────────────
  const openReschedule = (row) => {
    setPendingCancel(null);
    setPendingReschedule({ id: row.id, durationMin: row.service?.durationMin ?? 60 });
    setRescheduleDateTime(toDatetimeLocal(row.date));
  };

  const handleConfirmReschedule = () => {
    if (!rescheduleDateTime || !pendingReschedule) return;
    startTransition(async () => {
      const result = await adminRescheduleAppointment(pendingReschedule.id, rescheduleDateTime);
      if (!result?.success) {
        alert(result?.error || "No se pudo reagendar la cita.");
        return;
      }
      const newStart = new Date(rescheduleDateTime);
      const newEnd = new Date(newStart.getTime() + pendingReschedule.durationMin * 60000);
      setRows((prev) =>
        prev.map((row) =>
          row.id === pendingReschedule.id
            ? { ...row, date: newStart.toISOString(), endDate: newEnd.toISOString() }
            : row
        )
      );
      setPendingReschedule(null);
      setRescheduleDateTime("");
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Fecha</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Paciente</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Profesional</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Servicio</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Estado</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Motivo</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Cancelado por</th>
            <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <Fragment key={row.id}>
              <tr className="hover:bg-slate-50 transition">
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {new Date(row.date).toLocaleString("es-CR")}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{row.patient?.name || "—"}</div>
                  <div className="text-xs text-slate-400">{row.patient?.email || ""}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{row.professional?.user?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-700">{row.service?.title || "—"}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white"
                    value={pendingCancel?.id === row.id ? pendingCancel.status : row.status}
                    disabled={isPending}
                    onChange={(e) => handleStatusChange(row.id, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 max-w-[180px]">
                  {row.cancelReason
                    ? <span className="text-slate-700 text-xs">{row.cancelReason}</span>
                    : <span className="text-slate-400">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  {row.canceledBy ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${CANCELED_BY_BADGE[row.canceledBy] || "bg-slate-50 text-slate-800 border-slate-200"}`}>
                      {CANCELED_BY_LABELS[row.canceledBy] || row.canceledBy}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openReschedule(row)}
                    disabled={isPending}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded text-xs font-bold transition disabled:opacity-50"
                  >
                    Reagendar
                  </button>
                </td>
              </tr>

              {/* Fila inline: cancelación */}
              {pendingCancel?.id === row.id && (
                <tr className="bg-amber-50">
                  <td colSpan={8} className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-amber-800">
                        Motivo de cancelación:
                      </span>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmCancel()}
                        placeholder="Escribe el motivo (obligatorio)"
                        className="flex-1 min-w-[240px] rounded-md border border-amber-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        autoFocus
                      />
                      <button
                        onClick={handleConfirmCancel}
                        disabled={!cancelReason.trim() || isPending}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setPendingCancel(null); setCancelReason(""); }}
                        disabled={isPending}
                        className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded text-xs font-bold transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Fila inline: reagendamiento */}
              {pendingReschedule?.id === row.id && (
                <tr className="bg-indigo-50">
                  <td colSpan={8} className="px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-indigo-800">
                        Nueva fecha y hora:
                      </span>
                      <input
                        type="datetime-local"
                        value={rescheduleDateTime}
                        onChange={(e) => setRescheduleDateTime(e.target.value)}
                        className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        autoFocus
                      />
                      {rescheduleDateTime && (
                        <span className="text-xs text-indigo-700 font-medium">
                          Fin estimado: {calcEndTime(rescheduleDateTime, pendingReschedule.durationMin) || "—"}
                        </span>
                      )}
                      <button
                        onClick={handleConfirmReschedule}
                        disabled={!rescheduleDateTime || isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setPendingReschedule(null); setRescheduleDateTime(""); }}
                        disabled={isPending}
                        className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded text-xs font-bold transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}

          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-slate-400" colSpan={8}>
                No hay citas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
