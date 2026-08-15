// Lectura de una nota de cierre.
//
// Lo comparten el profesional tratante y la dirección clínica: es exactamente el
// mismo texto para los dos, porque una nota que se escribe distinta según quién
// la vaya a leer no sirve como expediente.

import { TIPOS_CIERRE } from "@/lib/casos-policy";

function Bloque({ titulo, texto }) {
  if (!texto) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h4>
      <p className="mt-1 whitespace-pre-line leading-relaxed text-slate-800">{texto}</p>
    </div>
  );
}

export default function NotaDeCierre({ caso }) {
  if (!caso?.tipoCierre) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">Nota de cierre</h3>
        <span className="text-sm font-semibold text-slate-600">
          {TIPOS_CIERRE[caso.tipoCierre]?.label || caso.tipoCierre}
        </span>
      </div>

      <Bloque titulo="Evolución del proceso" texto={caso.cierreEvolucion} />
      <Bloque titulo="Estado al cierre" texto={caso.cierreEstadoActual} />
      <Bloque titulo="Recomendaciones y plan" texto={caso.cierreRecomendaciones} />
      <Bloque titulo="Derivación" texto={caso.cierreReferencia} />

      {caso.visadoAt ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Visado el{" "}
          {new Date(caso.visadoAt).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Conservación obligatoria hasta{" "}
          {caso.conservarHasta
            ? new Date(caso.conservarHasta).toLocaleDateString("es-CR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "—"}
          .
        </p>
      ) : null}
    </div>
  );
}
