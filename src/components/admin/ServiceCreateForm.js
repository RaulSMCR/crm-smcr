"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createService } from "@/actions/service-actions";

export default function ServiceCreateForm() {
  const router = useRouter();
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
          const result = await createService(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.success && result?.newId) {
            setMessage("Servicio creado correctamente. Redirigiendo...");
            setTimeout(() => {
              router.push(`/panel/admin/servicios/${result.newId}`);
            }, 1000);
          }
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Título *</span>
          <input
            name="title"
            placeholder="ej: Consulta de 60 minutos"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Precio (CRC) *</span>
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            placeholder="ej: 25000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Duración (minutos) *</span>
          <input
            name="durationMin"
            type="number"
            min="1"
            step="1"
            placeholder="ej: 60"
            defaultValue="60"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="block mb-1 font-medium">Estado</span>
          <select
            name="isActive"
            defaultValue="true"
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
          placeholder="Describe brevemente el servicio (opcional)"
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          {message}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-6 py-2 text-white font-medium disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear servicio"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-300 px-6 py-2 text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
