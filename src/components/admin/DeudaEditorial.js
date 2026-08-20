// Las dos tablas de la Zona 5: qué le falta a cada pieza, y qué derivados tiene.
//
// Son consultas, no checkboxes. Es la diferencia entre una lista que se vacía
// sola a medida que se carga y una que hay que mantener a mano — y que por eso
// queda desactualizada y deja de creerse.
//
// Componente de servidor: no necesita interacción, y así los datos llegan en el
// HTML sin un viaje extra.

import Link from "next/link";

function Marca({ ok }) {
  return ok ? (
    <span className="text-emerald-700" aria-label="listo">
      ●
    </span>
  ) : (
    <span className="text-slate-300" aria-label="falta">
      ○
    </span>
  );
}

export default function DeudaEditorial({ deuda, pipeline }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-xl font-bold text-brand-900">Deuda editorial</h2>
          <p className="text-sm text-slate-500">
            {deuda.length ? `${deuda.length} piezas con algo pendiente` : "Nada pendiente"}
          </p>
        </div>

        {deuda.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Pieza</th>
                  <th className="py-2 pr-3">Qué le falta</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {deuda.map((fila, i) => (
                  <tr key={`${fila.tipo}-${i}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <span className="block text-xs uppercase tracking-wide text-slate-400">{fila.tipo}</span>
                      <span className="font-medium text-slate-900">{fila.nombre}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {fila.falta.map((f) => (
                          <span key={f} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
                            {f}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <Link href={fila.editar} className="font-semibold text-brand-700 underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Todas las piezas publicadas tienen sus metadatos y su bloque extractivo.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-xl font-bold text-brand-900">Pipeline por ensayo</h2>
          <p className="text-sm text-slate-500">Qué derivados tiene cada artículo publicado</p>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Las tres primeras columnas son las que <strong>pueden ser citadas</strong>: son texto. Slides y
          reels son distribución — importan, pero no de la misma manera, y la tabla lo separa para que la
          urgencia no se reparta por igual.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Ensayo</th>
                <th className="py-2 px-2 text-center" colSpan={3}>
                  Citable
                </th>
                <th className="py-2 px-2 text-center text-slate-400" colSpan={2}>
                  Distribución
                </th>
                <th className="py-2" />
              </tr>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th />
                <th className="py-1 px-2 text-center font-normal">Bloque</th>
                <th className="py-1 px-2 text-center font-normal">Video</th>
                <th className="py-1 px-2 text-center font-normal">Transcripción</th>
                <th className="py-1 px-2 text-center font-normal">Slides</th>
                <th className="py-1 px-2 text-center font-normal">Reels</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pipeline.map((fila) => (
                <tr key={fila.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900">{fila.titulo}</td>
                  {Object.entries(fila.citables).map(([k, v]) => (
                    <td key={k} className="px-2 py-2 text-center">
                      <Marca ok={v} />
                    </td>
                  ))}
                  {Object.entries(fila.distribucion).map(([k, v]) => (
                    <td key={k} className="bg-slate-50/60 px-2 py-2 text-center">
                      <Marca ok={v} />
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-2 text-right">
                    <Link href={fila.editar} className="font-semibold text-brand-700 underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
