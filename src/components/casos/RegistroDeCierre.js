// Lectura del registro administrativo de un cierre.
//
// Antes esto se llamaba "nota de cierre" y mostraba evolución, estado y
// recomendaciones. Ya no existe nada de eso: era contenido de expediente, y el
// expediente le pertenece a la persona y a su profesional. Lo que queda es lo
// que la plataforma sí tiene por qué saber.

import { TIPOS_CIERRE } from "@/lib/casos-policy";

function fechaLarga(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Dato({ titulo, children }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h4>
      <p className="mt-1 leading-relaxed text-slate-800">{children}</p>
    </div>
  );
}

export default function RegistroDeCierre({ caso }) {
  if (!caso?.tipoCierre) return null;

  const tipo = TIPOS_CIERRE[caso.tipoCierre];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">Registro de cierre</h3>
        <span className="text-sm font-semibold text-slate-600">
          {tipo?.label || caso.tipoCierre}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Dato administrativo. El expediente clínico lo conserva el profesional tratante.
      </p>

      <Dato titulo="Propuesto">{fechaLarga(caso.cierrePropuestoAt)}</Dato>

      {caso.derivadoA ? <Dato titulo="Se deriva a">{caso.derivadoA}</Dato> : null}

      <Dato titulo="Declaraciones del profesional">
        {caso.personaInformada
          ? "La persona fue informada del cierre."
          : "No fue posible informar a la persona (baja por abandono)."}
        <br />
        {caso.registradoEnExpediente
          ? "El cierre quedó registrado en su expediente."
          : "Sin constancia de registro en expediente."}
      </Dato>

      {caso.visadoAt ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Visado el {fechaLarga(caso.visadoAt)}. Este registro administrativo se conserva hasta{" "}
          {fechaLarga(caso.conservarHasta)}.
        </p>
      ) : null}
    </div>
  );
}
