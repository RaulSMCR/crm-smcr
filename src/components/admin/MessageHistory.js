"use client";

import { useState, useTransition } from "react";
import { eliminarMensaje } from "@/actions/mensajes-actions";

function formatearFecha(iso) {
  if (!iso) return "sin enviar";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function MessageHistory({ mensajes }) {
  const [pendiente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(null);

  if (!mensajes.length) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
        <h2 className="text-lg font-bold text-brand-900">Comunicados enviados</h2>
        <p className="mt-1 text-sm text-neutral-700">Todavía no se envió ninguno.</p>
      </section>
    );
  }

  function borrar(id) {
    iniciar(async () => {
      await eliminarMensaje(id);
      setConfirmando(null);
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <h2 className="text-lg font-bold text-brand-900">Comunicados enviados</h2>

      <div className="mt-3 space-y-3">
        {mensajes.map((m) => {
          const tasa = m.destinatarios ? Math.round((m.leidos / m.destinatarios) * 100) : 0;
          return (
            <article key={m.id} className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-950">{m.titulo}</h3>
                  <p className="mt-1 whitespace-pre-line text-xs text-neutral-700">{m.cuerpo}</p>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-700">
                  {m.destino}
                </span>
              </div>

              {m.filtro ? (
                <p className="mt-2 inline-block rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-900">
                  {m.filtro}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                <span>{formatearFecha(m.enviadoEl)}</span>
                <span className="font-semibold text-neutral-800">
                  {m.destinatarios} {m.destinatarios === 1 ? "destinatario" : "destinatarios"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-bold ${
                    tasa >= 50 ? "bg-brand-100 text-brand-900" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {m.leidos} leídos · {tasa}%
                </span>
                {m.pushSent > 0 ? <span>{m.pushSent} push</span> : <span>sin push</span>}

                {confirmando === m.id ? (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="font-semibold text-accent-950">¿Borrar y quitar de todos los buzones?</span>
                    <button
                      type="button"
                      onClick={() => borrar(m.id)}
                      disabled={pendiente}
                      className="rounded-lg border border-accent-500 px-2 py-1 font-semibold text-accent-950 disabled:opacity-50"
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="rounded-lg border border-neutral-300 px-2 py-1 font-semibold text-neutral-700"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(m.id)}
                    className="ml-auto rounded-lg border border-neutral-300 px-2 py-1 font-semibold text-neutral-700 hover:border-accent-300"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
