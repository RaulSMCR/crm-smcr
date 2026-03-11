"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createService } from "@/actions/service-actions";
import ServiceBannerField from "@/components/admin/ServiceBannerField";

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
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-medium text-slate-900">Banner del servicio</h3>
          <p className="text-sm text-slate-500">
            Esta imagen se mostrara en la home y en las paginas publicas del servicio.
          </p>
        </div>
        <ServiceBannerField />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Titulo *</span>
          <input
            name="title"
            placeholder="ej: Consulta de 60 minutos"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Precio (CRC) *</span>
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
          <span className="mb-1 block font-medium">Duración (minutos) *</span>
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
          <span className="mb-1 block font-medium">Orden de presentacion *</span>
          <input
            name="displayOrder"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Estado</span>
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

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Descripción</span>
        <textarea
          name="description"
          placeholder="Describe brevemente el servicio (opcional)"
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Obra</span>
          <input
            name="bannerArtworkTitle"
            placeholder="Ej: La noche estrellada"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="text-sm text-slate-700">
          <span className="mb-1 block font-medium">Autor</span>
          <input
            name="bannerArtworkAuthor"
            placeholder="Ej: Vincent van Gogh"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Reseña de la imagen</span>
        <textarea
          name="bannerArtworkNote"
          placeholder="Breve texto para reconocer la obra, contexto o técnica."
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-6 py-2 font-medium text-white disabled:opacity-60"
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
