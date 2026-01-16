"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeLabel(status) {
  switch (status) {
    case "CONFIRMED": return "Confirmada";
    case "PENDING": return "Pendiente";
    case "CANCELLED": return "Cancelada";
    case "COMPLETED": return "Completada";
    case "NO_SHOW": return "No asistió";
    default: return status;
  }
}

function money(v) {
  if (v === null || v === undefined) return "—";
  try {
    return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC" }).format(Number(v));
  } catch {
    return String(v);
  }
}

export default function UserAppointmentsPanel() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/appointments/my", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
      setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar tus citas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function cancelAppointment(apptId) {
    const reason = prompt("Motivo de cancelación (opcional). Dejá en blanco si no querés indicar motivo:");
    if (reason === null) return;
    if (!confirm("¿Confirmás la cancelación de esta cita?")) return;

    setBusyId(apptId);
    setError("");
    try {
      const res = await fetch(`/api/appointments/${apptId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
      await load();
    } catch (e) {
      setError(e?.message || "No se pudo cancelar la cita.");
    } finally {
      setBusyId(null);
    }
  }

  const hasAppointments = useMemo(() => appointments.length > 0, [appointments]);

  return (
    <section className="mt-8 bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Tus citas</h2>
          <p className="text-sm text-gray-600 mt-1">
            Podés cancelar o reagendar. La reprogramación se realiza respetando las políticas del servicio.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Link
            href="/agendar"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            Agendar nueva cita
          </Link>

          <Link
            href="/profesionales"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50"
          >
            Seguir navegando
          </Link>
        </div>
      </div>

      <div className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <strong>Reagendar:</strong> se gestiona desde el calendario del profesional y está sujeto a las{" "}
        <Link className="underline" href="/terminos">políticas del servicio</Link>.
      </div>

      {error ? (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-center text-gray-600">Cargando citas…</div>
      ) : !hasAppointments ? (
        <div className="mt-6 text-center text-gray-600">Aún no tenés citas agendadas.</div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-3">Fecha y hora</th>
                <th className="py-2 pr-3">Profesional</th>
                <th className="py-2 pr-3">Lugar</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const busy = busyId === a.id;
                const calendarUrl = a?.professional?.calendarUrl || "";
                const cancellable = !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(a.status);

                // Lugar: no existe en Prisma aún. Por ahora:
                // - Si el profesional tiene calendarUrl, asumimos "Online / según calendario"
                // - Si no, "Por definir"
                const place = calendarUrl ? "Según calendario del profesional" : "Por definir";

                // Valor: preferimos priceFinal si está, si no usamos el price del servicio
                const value = a.priceFinal ?? a?.service?.price ?? null;

                return (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-3 whitespace-nowrap">
                      {fmt(a.startTime)} <span className="text-gray-500">– {fmt(a.endTime)}</span>
                    </td>

                    <td className="py-3 pr-3">
                      {a?.professional?.name || "Profesional"}{" "}
                      {a?.professional?.profession ? (
                        <span className="text-gray-500">({a.professional.profession})</span>
                      ) : null}
                    </td>

                    <td className="py-3 pr-3">{place}</td>

                    <td className="py-3 pr-3 whitespace-nowrap">{money(value)}</td>

                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-md border bg-neutral-50">
                        {badgeLabel(a.status)}
                      </span>
                    </td>

                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => cancelAppointment(a.id)}
                          disabled={busy || !cancellable}
                          className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          {busy ? "Procesando…" : "Cancelar"}
                        </button>

                        {calendarUrl ? (
                          <a
                            href={calendarUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50"
                            onClick={(e) => {
                              const ok = confirm(
                                "Reagendar se realiza siguiendo las políticas del servicio y la disponibilidad del profesional. ¿Querés continuar?"
                              );
                              if (!ok) e.preventDefault();
                            }}
                          >
                            Reagendar
                          </a>
                        ) : (
                          <span className="px-3 py-2 rounded-lg border border-neutral-200 text-gray-500">
                            Reagendar (sin calendario)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
