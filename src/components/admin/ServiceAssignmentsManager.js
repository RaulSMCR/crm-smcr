"use client";

import { useMemo, useState, useTransition } from "react";
import { syncServiceAssignments } from "@/actions/service-actions";

export default function ServiceAssignmentsManager({ serviceId, professionals, selectedIds }) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCount = useMemo(() => selected.size, [selected]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        Seleccionados: <b>{selectedCount}</b>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {professionals.map((p) => {
          const checked = selected.has(p.id);
          return (
            <label
              key={p.id}
              className={`rounded-xl border p-3 flex items-start gap-3 cursor-pointer ${
                checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="mt-1" />
              <span>
                <span className="block font-medium text-slate-900">{p.user.name || "Sin nombre"}</span>
                <span className="block text-sm text-slate-600">{p.specialty || "Sin especialidad"}</span>
                <span className="block text-xs text-slate-500">{p.user.email}</span>
              </span>
            </label>
          );
        })}
      </div>

      {professionals.length === 0 ? (
        <p className="text-sm text-slate-600">
          No hay profesionales aprobados/activos disponibles para asignar.
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage("");
          setError("");
          startTransition(async () => {
            const result = await syncServiceAssignments(serviceId, Array.from(selected));
            if (result?.error) {
              setError(result.error);
              return;
            }
            setMessage("Asignaciones actualizadas correctamente.");
          });
        }}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar asignaciones"}
      </button>
    </div>
  );
}
