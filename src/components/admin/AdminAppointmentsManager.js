"use client";

import { useState, useTransition } from "react";
import { adminUpdateAppointmentStatus } from "@/actions/admin-appointments-actions";

const STATUS_OPTIONS = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED_BY_USER",
  "CANCELLED_BY_PRO",
];

export default function AdminAppointmentsManager({ appointments = [] }) {
  const [rows, setRows] = useState(appointments);
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (appointmentId, nextStatus) => {
    startTransition(async () => {
      const result = await adminUpdateAppointmentStatus(appointmentId, nextStatus);
      if (!result?.success) {
        alert(result?.error || "No se pudo actualizar la cita.");
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === appointmentId ? { ...row, status: nextStatus } : row
        )
      );
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th className="text-left px-4 py-3">Fecha</th>
            <th className="text-left px-4 py-3">Paciente</th>
            <th className="text-left px-4 py-3">Profesional</th>
            <th className="text-left px-4 py-3">Servicio</th>
            <th className="text-left px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-neutral-100">
              <td className="px-4 py-3">{new Date(row.date).toLocaleString()}</td>
              <td className="px-4 py-3">{row.patient?.name || "—"}</td>
              <td className="px-4 py-3">{row.professional?.user?.name || "—"}</td>
              <td className="px-4 py-3">{row.service?.title || "—"}</td>
              <td className="px-4 py-3">
                <select
                  className="rounded-md border border-neutral-300 px-2 py-1"
                  value={row.status}
                  disabled={isPending}
                  onChange={(event) => handleStatusChange(row.id, event.target.value)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-center text-neutral-500" colSpan={5}>
                No hay citas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
