// src/components/admin/GoogleCalendarPicker.js
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listarCalendariosGoogle,
  guardarCalendariosGoogle,
} from "@/actions/google-connect-actions";

/**
 * Elegir en qué calendario de Google trabaja el profesional.
 *
 * Antes la app daba por sentado "primary". Cuando alguien se rige por otro
 * calendario de su cuenta, eso hacía dos cosas mal a la vez: publicaba las citas
 * donde esa persona no mira, y no veía lo que tenía ocupado donde sí trabaja.
 */
export default function GoogleCalendarPicker() {
  const [estado, setEstado] = useState(null);
  const [deTrabajo, setDeTrabajo] = useState("primary");
  const [extras, setExtras] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let vivo = true;
    listarCalendariosGoogle().then((result) => {
      if (!vivo) return;
      setCargando(false);
      if (!result?.success) {
        setFeedback({ tone: "error", text: result?.error || "No se pudieron leer sus calendarios." });
        return;
      }
      setEstado(result.data);
      setDeTrabajo(result.data.calendarioDeTrabajo);
      setExtras(result.data.tambienOcupan);
    });
    return () => {
      vivo = false;
    };
  }, []);

  function alternarExtra(id) {
    setExtras((actual) =>
      actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]
    );
  }

  function guardar() {
    setFeedback(null);
    startTransition(async () => {
      const result = await guardarCalendariosGoogle({
        calendarioDeTrabajo: deTrabajo,
        tambienOcupan: extras,
      });
      setFeedback(
        result?.success
          ? { tone: "ok", text: "Guardado. Las citas nuevas se publicarán en ese calendario." }
          : { tone: "error", text: result?.error || "No se pudo guardar." }
      );
    });
  }

  if (cargando) {
    return <p className="text-sm text-slate-500">Leyendo sus calendarios de Google...</p>;
  }

  if (!estado) {
    return feedback ? (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {feedback.text}
      </p>
    ) : null;
  }

  const escribibles = estado.calendarios.filter((c) => c.puedeEscribir);
  const soloLectura = estado.calendarios.filter((c) => !c.puedeEscribir);

  return (
    <div className="space-y-5 border-t border-slate-200 pt-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Su calendario de trabajo</h3>
        <p className="mt-1 text-sm text-slate-600">
          Acá se publican sus citas y de acá se lee lo que le ocupa la agenda. Solo aparecen los
          calendarios en los que usted puede escribir.
        </p>

        <div className="mt-3 space-y-1.5">
          {escribibles.map((cal) => (
            <label
              key={cal.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <input
                type="radio"
                name="calendario-de-trabajo"
                checked={deTrabajo === (cal.esPrimary ? "primary" : cal.id)}
                onChange={() => setDeTrabajo(cal.esPrimary ? "primary" : cal.id)}
                className="h-4 w-4"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{cal.nombre}</span>
              {cal.esPrimary && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                  principal
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">Otros calendarios que le ocupan el tiempo</h3>
        <p className="mt-1 text-sm text-slate-600">
          Lo que esté ocupado en los que marque tampoco se le ofrecerá a ningún paciente. De estos
          solo se lee la disponibilidad, nunca el contenido.
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Revise los nombres antes de marcar: un calendario que signifique <em>libre</em>,{" "}
          <em>cancelado</em> o <em>disponible</em> le cerraría horas que en realidad tiene abiertas.
        </p>

        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {[...escribibles, ...soloLectura]
            .filter((cal) => (cal.esPrimary ? "primary" : cal.id) !== deTrabajo)
            .map((cal) => (
              <label
                key={cal.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={extras.includes(cal.id)}
                  onChange={() => alternarExtra(cal.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{cal.nombre}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{cal.acceso}</span>
              </label>
            ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar selección"}
        </button>
        <span className="text-xs text-slate-500">
          {extras.length === 0
            ? "Ningún calendario adicional marcado."
            : `${extras.length} calendario${extras.length === 1 ? "" : "s"} adicional${
                extras.length === 1 ? "" : "es"
              }.`}
        </span>
      </div>

      {feedback && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            feedback.tone === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
