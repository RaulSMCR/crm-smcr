"use client";

// Lista de pacientes con la agenda en pausa.
//
// El orden de la tarjeta sigue el orden real del trabajo: primero escribirle,
// después restituir. Restituir sin haber contactado deja al paciente creyendo
// que puede agendar sin saber que hay un cargo pendiente, así que el botón de
// restituir es el secundario, no el principal.

import { useState, useTransition } from "react";
import { restituirAgendaDePaciente } from "@/actions/scheduling-block-actions";
import Toast from "@/components/ui/Toast";

function formatFecha(valor) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));
}

export default function PausedSchedulesPanel({ pacientes = [] }) {
  const [toast, setToast] = useState(null);
  const [restituidos, setRestituidos] = useState([]);
  const [isPending, startTransition] = useTransition();

  const pendientes = pacientes.filter((p) => !restituidos.includes(p.id));

  function restituir(paciente) {
    startTransition(async () => {
      const res = await restituirAgendaDePaciente(paciente.id);
      if (res?.error) {
        setToast({ message: res.error, type: "error" });
        return;
      }
      setRestituidos((prev) => [...prev, paciente.id]);
      setToast({ message: `${paciente.name} ya puede agendar.`, type: "success" });
    });
  }

  if (pendientes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-700">No hay agendas en pausa.</p>
        <p className="mt-1 text-sm text-slate-500">
          Acá aparecen los pacientes que hay que contactar antes de que puedan volver a agendar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendientes.map((p) => (
          <div key={p.id} className="rounded-2xl border border-amber-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {p.phone || "sin teléfono"} · {p.email}
                </p>
                <p className="mt-2 inline-block rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  {p.motivo}
                </p>
              </div>

              <dl className="text-right text-sm text-slate-600">
                {p.profesional && (
                  <div>
                    <dt className="sr-only">Profesional</dt>
                    <dd className="font-medium text-slate-800">{p.profesional}</dd>
                  </div>
                )}
                {p.ultimaCita && (
                  <div className="mt-1">
                    <dt className="sr-only">Última cita</dt>
                    <dd>{formatFecha(p.ultimaCita)}</dd>
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-500">
                  En pausa desde {formatFecha(p.bloqueadoDesde)}
                </div>
              </dl>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {p.whatsapp ? (
                <a
                  href={p.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Escribirle por WhatsApp
                </a>
              ) : (
                <span className="text-sm text-slate-500">
                  Sin teléfono registrado: contactar por correo.
                </span>
              )}

              <button
                type="button"
                onClick={() => restituir(p)}
                disabled={isPending}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isPending ? "Restituyendo..." : "Restituir el acceso"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </>
  );
}
