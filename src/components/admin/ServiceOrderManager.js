"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkUpdateServiceOrder } from "@/actions/service-actions";

export default function ServiceOrderManager({ services = [] }) {
  const [rows, setRows] = useState(
    services.map((service) => ({
      id: service.id,
      title: service.title,
      isActive: Boolean(service.isActive),
      displayOrder: Number(service.displayOrder ?? 0),
    }))
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.title.localeCompare(b.title, "es");
      }),
    [rows]
  );

  const setOrder = (id, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              displayOrder: Number.isFinite(Number(value)) ? Number(value) : 0,
            }
          : row
      )
    );
  };

  const normalizeSequential = () => {
    const next = sortedRows.map((row, index) => ({
      ...row,
      displayOrder: (index + 1) * 10,
    }));
    setRows(next);
    setMessage("Orden normalizado en saltos de 10. Guarda para aplicar.");
    setError("");
  };

  const moveRow = (id, direction) => {
    const index = sortedRows.findIndex((row) => row.id === id);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedRows.length) return;

    const current = sortedRows[index];
    const target = sortedRows[targetIndex];

    const nextOrderById = new Map(
      sortedRows.map((row) => [
        row.id,
        row.id === current.id
          ? target.displayOrder
          : row.id === target.id
            ? current.displayOrder
            : row.displayOrder,
      ])
    );

    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        displayOrder: Number(nextOrderById.get(row.id) ?? row.displayOrder),
      }))
    );
    setMessage("Cambio de posición aplicado. Guarda para confirmar.");
    setError("");
  };

  const save = () => {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await bulkUpdateServiceOrder(
        rows.map((row) => ({
          id: row.id,
          displayOrder: row.displayOrder,
        }))
      );

      if (result?.error) {
        setError(result.error);
        return;
      }

      setMessage("Orden actualizado correctamente.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">
          Edita el orden de todos los servicios en una sola vista y guarda cambios masivos.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={normalizeSequential}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Normalizar (10,20,30)
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar orden"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr className="text-sm text-slate-600">
                <th className="px-4 py-3 font-semibold">Servicio</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Orden</th>
                <th className="px-4 py-3 font-semibold">Mover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-800">{row.title}</td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Activo
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.displayOrder}
                      onChange={(e) => setOrder(row.id, e.target.value)}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveRow(row.id, "up")}
                        disabled={index === 0}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRow(row.id, "down")}
                        disabled={index === sortedRows.length - 1}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Bajar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No hay servicios disponibles.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
