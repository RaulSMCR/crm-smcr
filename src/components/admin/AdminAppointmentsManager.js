"use client";

import { Fragment, useCallback, useState, useTransition } from "react";
import { adminUpdateAppointmentStatus, adminRescheduleAppointment } from "@/actions/admin-appointments-actions";
import Toast from "@/components/ui/Toast";

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  NO_SHOW: "No asistio",
  CANCELLED_BY_USER: "Cancelada por paciente",
  CANCELLED_BY_PRO: "Cancelada por profesional",
};

const CANCEL_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

const CANCELED_BY_BADGE = {
  PATIENT: "border-blue-200 bg-blue-50 text-blue-800",
  PROFESSIONAL: "border-orange-200 bg-orange-50 text-orange-800",
  ADMIN: "border-slate-200 bg-slate-50 text-slate-800",
};

const CANCELED_BY_LABELS = {
  PATIENT: "Paciente",
  PROFESSIONAL: "Profesional",
  ADMIN: "Admin",
};

const RESCHEDULED_BY_LABELS = {
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

function isOverdueNoAction(row) {
  if (!["PENDING", "CONFIRMED"].includes(row.status)) return false;
  if (!row.endDate) return false;
  return new Date(row.endDate) < new Date();
}

function getLatestApprovedPayment(row) {
  if (!Array.isArray(row.paymentTransactions)) return null;
  return row.paymentTransactions.find((tx) => tx.status === "APPROVED") || null;
}

function getLatestInvoice(row) {
  if (!Array.isArray(row.invoices) || row.invoices.length === 0) return null;
  return row.invoices[0];
}

export default function AdminAppointmentsManager({ appointments = [] }) {
  const [rows, setRows] = useState(appointments);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [pendingCancel, setPendingCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [pendingReschedule, setPendingReschedule] = useState(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");

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
        setToast({ message: result?.error || "No se pudo actualizar la cita.", type: "error" });
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

      setToast({ message: `Estado actualizado: ${STATUS_LABELS[nextStatus] || nextStatus}.`, type: "success" });
      setPendingCancel(null);
      setCancelReason("");
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim() || !pendingCancel) return;
    applyStatusChange(pendingCancel.id, pendingCancel.status, cancelReason.trim());
  };

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
        setToast({ message: result?.error || "No se pudo reagendar la cita.", type: "error" });
        return;
      }

      const newStart = new Date(rescheduleDateTime);
      const newEnd = new Date(newStart.getTime() + pendingReschedule.durationMin * 60000);
      setRows((prev) =>
        prev.map((row) =>
          row.id === pendingReschedule.id
            ? {
                ...row,
                date: newStart.toISOString(),
                endDate: newEnd.toISOString(),
                lastRescheduledBy: "ADMIN",
                lastRescheduledAt: new Date().toISOString(),
                rescheduleCount: Number(row.rescheduleCount || 0) + 1,
              }
            : row
        )
      );
      setToast({ message: "Cita reagendada correctamente.", type: "success" });
      setPendingReschedule(null);
      setRescheduleDateTime("");
    });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Fecha</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Paciente</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Profesional</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Servicio</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Estado</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Pago</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Comprobante</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Factura</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Reagendada por</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Motivo</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Cancelado por</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const overdue = isOverdueNoAction(row);
            const approvedPayment = getLatestApprovedPayment(row);
            const latestInvoice = getLatestInvoice(row);
            const paid = row.paymentStatus === "PAID" || Boolean(approvedPayment);

            return (
              <Fragment key={row.id}>
                <tr className={overdue ? "bg-amber-50" : "transition hover:bg-slate-50"}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {new Date(row.date).toLocaleString("es-CR")}
                    {overdue && (
                      <div className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        Alerta vencida
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{row.patient?.name || "-"}</div>
                    <div className="text-xs text-slate-400">{row.patient?.email || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.professional?.user?.name || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{row.service?.title || "-"}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                      value={pendingCancel?.id === row.id ? pendingCancel.status : row.status}
                      disabled={isPending}
                      onChange={(e) => handleStatusChange(row.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {paid ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        Pagada
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="max-w-[210px] px-4 py-3 text-xs text-slate-700">
                    {approvedPayment ? (
                      <div>
                        <div className="font-semibold">{approvedPayment.p2pReference || "Sin referencia"}</div>
                        <div className="text-slate-500">
                          {approvedPayment.p2pPaymentDate ? new Date(approvedPayment.p2pPaymentDate).toLocaleString("es-CR") : "Fecha no disponible"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {latestInvoice ? (
                      <div>
                        <div className="font-semibold">{latestInvoice.invoiceNumber}</div>
                        <div className="text-slate-500">{latestInvoice.status}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.lastRescheduledBy ? (
                      <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                        {RESCHEDULED_BY_LABELS[row.lastRescheduledBy] || row.lastRescheduledBy}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-4 py-3">
                    {row.cancelReason ? <span className="text-xs text-slate-700">{row.cancelReason}</span> : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {row.canceledBy ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          CANCELED_BY_BADGE[row.canceledBy] || "border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      >
                        {CANCELED_BY_LABELS[row.canceledBy] || row.canceledBy}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openReschedule(row)}
                      disabled={isPending}
                      className="rounded border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                    >
                      Reagendar
                    </button>
                  </td>
                </tr>

                {pendingCancel?.id === row.id && (
                  <tr className="bg-amber-50">
                    <td colSpan={12} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-amber-800">Motivo de cancelacion:</span>
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleConfirmCancel()}
                          placeholder="Escribe el motivo (obligatorio)"
                          className="min-w-[240px] flex-1 rounded-md border border-amber-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          autoFocus
                        />
                        <button
                          onClick={handleConfirmCancel}
                          disabled={!cancelReason.trim() || isPending}
                          className="rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setPendingCancel(null);
                            setCancelReason("");
                          }}
                          disabled={isPending}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {pendingReschedule?.id === row.id && (
                  <tr className="bg-indigo-50">
                    <td colSpan={12} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-indigo-800">Nueva fecha y hora:</span>
                        <input
                          type="datetime-local"
                          value={rescheduleDateTime}
                          onChange={(e) => setRescheduleDateTime(e.target.value)}
                          className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          autoFocus
                        />
                        {rescheduleDateTime && (
                          <span className="text-xs font-medium text-indigo-700">
                            Fin estimado: {calcEndTime(rescheduleDateTime, pendingReschedule.durationMin) || "-"}
                          </span>
                        )}
                        <button
                          onClick={handleConfirmReschedule}
                          disabled={!rescheduleDateTime || isPending}
                          className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setPendingReschedule(null);
                            setRescheduleDateTime("");
                          }}
                          disabled={isPending}
                          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-slate-400" colSpan={12}>
                No hay citas registradas para este filtro.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
