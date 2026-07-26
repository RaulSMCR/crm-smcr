"use client";

import { useState, useTransition } from "react";
import { marcarLeido } from "@/actions/mensajes-actions";

function formatearFecha(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Buzón del paciente. El acuse de lectura se dispara al abrir el mensaje, no al
 * renderizar la lista: ver el título en una lista no es haber leído.
 */
export default function MessageInbox({ mensajes }) {
  const [, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(null);
  const [leidos, setLeidos] = useState(() =>
    Object.fromEntries(mensajes.map((m) => [m.id, m.leido])),
  );

  function alternar(mensaje) {
    const seAbre = abierto !== mensaje.id;
    setAbierto(seAbre ? mensaje.id : null);

    if (seAbre && !leidos[mensaje.id]) {
      setLeidos((prev) => ({ ...prev, [mensaje.id]: true }));
      iniciar(async () => {
        await marcarLeido(mensaje.id);
      });
    }
  }

  if (!mensajes.length) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-appbg p-5 text-center">
        <p className="text-sm text-neutral-600">Todavía no tenés mensajes.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {mensajes.map((mensaje) => {
        const leido = leidos[mensaje.id];
        const estaAbierto = abierto === mensaje.id;
        return (
          <li key={mensaje.id}>
            <article
              className={`overflow-hidden rounded-2xl border shadow-card transition-colors ${
                leido ? "border-neutral-200 bg-appbg" : "border-brand-300 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => alternar(mensaje)}
                aria-expanded={estaAbierto}
                className="flex w-full items-start gap-3 px-5 py-4 text-left"
              >
                {!leido ? (
                  <span
                    aria-label="sin leer"
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600"
                  />
                ) : (
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      leido ? "font-medium text-neutral-800" : "font-bold text-neutral-950"
                    }`}
                  >
                    {mensaje.titulo}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {formatearFecha(mensaje.enviadoEl)}
                  </span>
                </span>
                <span aria-hidden="true" className="mt-1 shrink-0 text-neutral-400">
                  {estaAbierto ? "▲" : "▼"}
                </span>
              </button>

              {estaAbierto ? (
                <div className="border-t border-neutral-200 px-5 py-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800">
                    {mensaje.cuerpo}
                  </p>
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
