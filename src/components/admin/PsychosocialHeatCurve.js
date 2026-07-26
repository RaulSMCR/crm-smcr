import Link from "next/link";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

// Misma escala secuencial que el resto del panel: un solo tono, porque
// globals.css aplasta las variantes de rojo y verde a un color único.
function claseCalor(calor) {
  if (calor >= 9) return "bg-accent-700 text-white";
  if (calor >= 8) return "bg-accent-500 text-white";
  if (calor >= 7) return "bg-accent-300 text-accent-950";
  if (calor >= 6) return "bg-accent-100 text-accent-950";
  return "bg-neutral-100 text-neutral-600";
}

/**
 * Curva diaria de calor psicosocial (0–10) del corpus de frases, mes por mes.
 * Es la resolución fina que le falta a la matriz mensual de ejes: la matriz dice
 * qué carga el mes, esta curva dice qué día concreto conviene pautar.
 */
export default function PsychosocialHeatCurve({ meses, hoy }) {
  if (!meses.length) return null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-brand-900">Curva diaria de calor</h2>
        <p className="text-sm text-neutral-650">
          Carga psíquica esperada día por día, de 0 a 10. Los días de 9 y 10 exigen pieza
          producida y revisión humana; los de 5 y 6 admiten frase sola sobre fondo de marca.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {meses.map((mes) => (
          <div key={`${mes.anio}-${mes.mes}`} className="flex flex-wrap items-center gap-2">
            <div className="w-28 shrink-0">
              <div className="text-xs font-bold text-neutral-800">
                {NOMBRES_MES[mes.mes - 1]} {String(mes.anio).slice(2)}
              </div>
              <div className="text-[10px] font-semibold text-neutral-500 tabular-nums">
                prom {mes.promedio} · máx {mes.maximo}
              </div>
            </div>

            <div className="flex flex-wrap gap-0.5">
              {mes.dias.map((d) => (
                <Link
                  key={d.fecha}
                  href={`/panel/admin/frases?fecha=${d.fecha}`}
                  title={`${d.fecha} · calor ${d.calor}/10${d.evento ? ` · ${d.evento}` : ""}${
                    d.sensible ? " · ventana sensible" : ""
                  }`}
                  className={`flex h-7 w-6 items-center justify-center rounded-sm text-[10px] font-bold tabular-nums ${claseCalor(
                    d.calor,
                  )} ${d.fecha === hoy ? "ring-2 ring-brand-900" : ""} ${
                    d.sensible ? "underline decoration-2 underline-offset-2" : ""
                  }`}
                >
                  {Number(d.fecha.slice(8))}
                </Link>
              ))}
            </div>

            {mes.sensibles ? (
              <span className="text-[10px] font-semibold text-neutral-500">
                {mes.sensibles} sensibles
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-700">
        <span className="font-semibold">Calor</span>
        {[5, 6, 7, 8, 9].map((c) => (
          <span key={c} className={`rounded px-2 py-1 font-bold ${claseCalor(c)}`}>
            {c}
          </span>
        ))}
        <span className="text-neutral-600">Subrayado = ventana sensible.</span>
      </div>
    </section>
  );
}
