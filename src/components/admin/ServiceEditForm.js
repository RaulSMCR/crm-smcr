"use client";

import { useState, useTransition } from "react";
import { updateServiceDetails } from "@/actions/service-actions";

export default function ServiceEditForm({ service }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage("");
        setError("");
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
          const result = await updateServiceDetails(service.id, formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setMessage("Servicio actualizado correctamente.");
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Título</span>
          <input
            name="title"
            defaultValue={service.title || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Precio (CRC)</span>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue={service.price?.toString?.() || "0"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Duración (min)</span>
          <input
            name="durationMin"
            type="number"
            min="1"
            step="1"
            defaultValue={service.durationMin || 60}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Estado</span>
          <select
            name="isActive"
            defaultValue={service.isActive ? "true" : "false"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </label>
      </div>

      <label className="text-sm text-slate-700 block">
        <span className="block mb-1 font-medium">Descripción</span>
        <textarea
          name="description"
          defaultValue={service.description || ""}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
