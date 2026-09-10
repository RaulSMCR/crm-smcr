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
  const [avisos, setAvisos] = useState([]);
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
      setAvisos(result.data.soloAvisan || []);
    });
    return () => {
      vivo = false;
    };
  }, []);

  /** Cada calendario adicional está en uno de tres modos, excluyentes. */
  function modoDe(id) {
    if (extras.includes(id)) return "ocupa";
    if (avisos.includes(id)) return "avisa";
    return "no";
  }

  function cambiarModo(id, modo) {
    setExtras((actual) => (modo === "ocupa" ? [...new Set([...actual, id])] : actual.filter((x) => x !== id)));
    setAvisos((actual) => (modo === "avisa" ? [...new Set([...actual, id])] : actual.filter((x) => x !== id)));
  }

  function guardar() {
    setFeedback(null);
    startTransition(async () => {
      const result = await guardarCalendariosGoogle({
        calendarioDeTrabajo: deTrabajo,
        tambienOcupan: extras,
        soloAvisan: avisos,
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
        <h3 className="text-sm font-semibold text-slate-800">Sus otros calendarios</h3>
        <p className="mt-1 text-sm text-slate-600">
          <strong className="font-semibold">Me ocupa</strong>: ese rato deja de ofrecerse y nadie
          puede agendar ahí.{" "}
          <strong className="font-semibold">Solo avisa</strong>: el horario sigue disponible, pero
          antes de confirmar se le advierte al paciente y usted lo ve marcado en su agenda. Los
          feriados van acá.
        </p>
        <p className="mt-1 text-xs text-amber-800">
          Revise los nombres antes de marcar <em>Me ocupa</em>: un calendario que signifique{" "}
          <em>libre</em>, <em>cancelado</em> o <em>disponible</em> le cerraría horas que en realidad
          tiene abiertas.
        </p>

        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {[...escribibles, ...soloLectura]
            .filter((cal) => (cal.esPrimary ? "primary" : cal.id) !== deTrabajo)
            .map((cal) => (
              <div
                key={cal.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={cal.nombre}>
                  {cal.nombre}
                </span>
                <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{cal.acceso}</span>
                <select
                  value={modoDe(cal.id)}
                  onChange={(event) => cambiarModo(cal.id, event.target.value)}
                  className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="no">No lo use</option>
                  <option value="ocupa">Me ocupa</option>
                  <option value="avisa">Solo avisa</option>
                </select>
              </div>
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
          {extras.length === 0 && avisos.length === 0
            ? "Ningún calendario adicional marcado."
            : `${extras.length} que ocupan, ${avisos.length} que solo avisan.`}
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
