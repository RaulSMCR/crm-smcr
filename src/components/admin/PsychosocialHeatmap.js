import { EJES, NOMBRES_MES, ESCALA_MAXIMA } from "@/lib/psychosocial-calendar";

// Escala secuencial de un solo tono. No se usa la rampa verde→rojo habitual por
// una razón concreta de este proyecto: globals.css aplasta con !important todas
// las variantes de bg-red-*, bg-orange-* y bg-green-* a un único color, así que
// una rampa construida sobre esos alias renderizaría cinco celdas idénticas.
// `accent` y `neutral` son escalas reales y solo se pisan en <a>/<button>: por
// eso las celdas son <td> y no botones.
//
// Las clases van escritas completas a propósito: Tailwind escanea texto y no
// vería `bg-accent-${n}00`.
const ESCALA_CARGA = [
  "bg-neutral-100 text-neutral-600",
  "bg-accent-100 text-accent-950",
  "bg-accent-300 text-accent-950",
  "bg-accent-500 text-white",
  "bg-accent-700 text-white",
];

// La oportunidad es otra magnitud (no es sufrimiento, es acceso a la atención),
// así que va en el otro tono de la marca para que no se lea como más carga.
const ESCALA_OPORTUNIDAD = [
  "bg-neutral-100 text-neutral-600",
  "bg-brand-100 text-brand-900",
  "bg-brand-300 text-brand-950",
  "bg-brand-600 text-white",
];

const ETIQUETAS_CARGA = ["nula", "baja", "media", "alta", "crítica"];

function nivelDeOportunidad(valor) {
  if (valor >= 2.5) return 3;
  if (valor >= 1.5) return 2;
  if (valor >= 0.5) return 1;
  return 0;
}

export default function PsychosocialHeatmap({ columnas, mesActual, anioActual }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-brand-900">Mapa térmico del año</h2>
        <p className="text-sm text-neutral-650">
          Carga psicosocial por eje, en escala de 0 a 4. La última fila no es carga: es cuánta
          atención está disponible, es decir fatiga acumulada menos ruido institucional.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-separate border-spacing-1 text-center">
          <caption className="sr-only">
            Carga psicosocial mensual por eje, de 0 (nula) a 4 (crítica)
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-40 text-left text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
                Eje
              </th>
              {columnas.map((columna) => {
                const esActual = columna.mes === mesActual && columna.anio === anioActual;
                return (
                  <th
                    key={`${columna.anio}-${columna.mes}`}
                    scope="col"
                    className={`px-1 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                      esActual ? "rounded-md bg-brand-900 text-white" : "text-neutral-600"
                    }`}
                  >
                    {NOMBRES_MES[columna.mes - 1].slice(0, 3)}
                    <span className="block text-[9px] font-semibold opacity-70">
                      {String(columna.anio).slice(2)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {EJES.map((eje) => (
              <tr key={eje.id}>
                <th
                  scope="row"
                  className="text-left text-xs font-semibold text-neutral-800"
                  title={eje.descripcion}
                >
                  {eje.label}
                </th>
                {columnas.map((columna) => {
                  const valor = columna.ejes[eje.id] ?? 0;
                  const ajuste = columna.ajustes.find((a) => a.eje === eje.id);
                  return (
                    <td
                      key={`${columna.anio}-${columna.mes}-${eje.id}`}
                      className={`rounded-md px-1 py-2 text-sm font-bold tabular-nums ${ESCALA_CARGA[valor]}`}
                      title={`${eje.label} en ${NOMBRES_MES[columna.mes - 1]} ${columna.anio}: ${
                        ETIQUETAS_CARGA[valor]
                      }${ajuste ? ` (+${ajuste.delta} — ${ajuste.motivo})` : ""}`}
                    >
                      {valor}
                      {ajuste ? <span className="align-super text-[9px]">*</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr>
              <th
                scope="row"
                className="pt-3 text-left text-xs font-semibold text-brand-900"
                title="Fatiga acumulada menos ruido institucional. Alto = audiencia fatigada y poca competencia por su atención."
              >
                Ventana de oportunidad
              </th>
              {columnas.map((columna) => (
                <td
                  key={`op-${columna.anio}-${columna.mes}`}
                  className={`mt-3 rounded-md px-1 py-2 text-sm font-bold tabular-nums ${
                    ESCALA_OPORTUNIDAD[nivelDeOportunidad(columna.oportunidad)]
                  }`}
                  title={`Fatiga ${columna.fatiga} − ruido ${columna.ruido} = ${columna.oportunidad}`}
                >
                  {columna.oportunidad.toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Carga</span>
          {ESCALA_CARGA.map((clase, i) => (
            <span key={i} className={`rounded px-2 py-1 font-bold ${clase}`}>
              {i}
            </span>
          ))}
          <span className="text-neutral-600">0 nula · {ESCALA_MAXIMA} crítica</span>
        </div>
        <p className="text-neutral-600">* Ajuste calculado del calendario real de ese año.</p>
      </div>
    </section>
  );
}
