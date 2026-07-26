"use client";

import { useState, useTransition } from "react";
import { marcarFuenteVerificada } from "@/actions/frases-actions";

/**
 * Lista de verificación del Anexo A. El corpus advierte de referencias a obras
 * inexistentes y de glosas presentadas como citas literales; sin verificar la
 * fuente no se genera placa para redes. Ordenada por impacto: las primeras 60
 * cubren más de la mitad de las publicaciones del año.
 */
export default function PhraseSourceChecklist({ lista, total, verificadas }) {
  const [pendiente, iniciar] = useTransition();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [estado, setEstado] = useState(() =>
    Object.fromEntries(lista.map((f) => [f.clave, f.verificada])),
  );

  function alternar(fuente) {
    const siguiente = !estado[fuente.clave];
    setEstado((e) => ({ ...e, [fuente.clave]: siguiente }));
    iniciar(async () => {
      const r = await marcarFuenteVerificada({
        clave: fuente.clave,
        autor: fuente.autor,
        obra: fuente.obra,
        verificada: siguiente,
      });
      if (r?.error) setEstado((e) => ({ ...e, [fuente.clave]: !siguiente }));
    });
  }

  const cuenta = Object.values(estado).filter(Boolean).length;
  const visibles = soloPendientes ? lista.filter((f) => !estado[f.clave]) : lista;
  const acumulado = lista.reduce((n, f) => n + f.usos, 0);

  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-brand-900">Verificación de fuentes</h2>
          <p className="mt-1 text-sm text-neutral-650">
            El propio corpus advierte que hay referencias que no corresponden a obras existentes y
            entradas que son glosas, no citas literales. Verificá contra la edición antes de
            publicar, o reformulá el crédito como «según» cuando sea una glosa.
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-center">
          <div className="text-xl font-bold text-brand-900 tabular-nums">
            {cuenta}/{total}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            verificadas
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={() => setSoloPendientes((v) => !v)}
            className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
          />
          Solo pendientes
        </label>
        <span className="text-xs text-neutral-600">
          Estas {lista.length} fuentes sostienen {acumulado} de las 5.840 asignaciones del año.
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.1em] text-neutral-500">
              <th scope="col" className="py-2 pr-3">Usos</th>
              <th scope="col" className="py-2 pr-3">Autor</th>
              <th scope="col" className="py-2 pr-3">Obra declarada</th>
              <th scope="col" className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((fuente) => (
              <tr key={fuente.clave} className="border-b border-neutral-100">
                <td className="py-2 pr-3 text-xs font-bold tabular-nums text-neutral-700">
                  {fuente.usos}
                </td>
                <td className="py-2 pr-3 font-semibold text-neutral-900">{fuente.autor}</td>
                <td className="py-2 pr-3 italic text-neutral-700">{fuente.obra}</td>
                <td className="py-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(estado[fuente.clave])}
                      disabled={pendiente}
                      onChange={() => alternar(fuente)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-700 focus:ring-brand-600"
                    />
                    <span
                      className={`text-xs font-semibold ${
                        estado[fuente.clave] ? "text-brand-800" : "text-neutral-600"
                      }`}
                    >
                      {estado[fuente.clave] ? "verificada" : "pendiente"}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 text-sm text-brand-800">
          No queda ninguna fuente pendiente en este tramo de la lista.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-neutral-500">
        {verificadas} de {total} fuentes del corpus completo están verificadas.
      </p>
    </section>
  );
}
