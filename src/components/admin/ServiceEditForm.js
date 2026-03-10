"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateServiceDetails } from "@/actions/service-actions";
import ServiceBannerField from "@/components/admin/ServiceBannerField";
import Toast from "@/components/ui/Toast";

export default function ServiceEditForm({ service }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState(null);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setToast(null);
          const formData = new FormData(e.currentTarget);

          startTransition(async () => {
            const result = await updateServiceDetails(service.id, formData);
            if (result?.error) {
              setToast({ message: result.error, type: "error" });
              return;
            }
            setToast({ message: "Servicio actualizado correctamente.", type: "success" });
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium text-slate-900">Banner del servicio</h3>
            <p className="text-sm text-slate-500">
              Ajusta la imagen principal visible en home, listado y detalle del servicio.
            </p>
          </div>
          <ServiceBannerField serviceId={service.id} initialUrl={service.bannerImage || ""} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Titulo</span>
            <input
              name="title"
              defaultValue={service.title || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Precio (CRC)</span>
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
            <span className="mb-1 block font-medium">Duracion (min)</span>
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
            <span className="mb-1 block font-medium">Orden de presentacion</span>
            <input
              name="displayOrder"
              type="number"
              min="0"
              step="1"
              defaultValue={service.displayOrder ?? 0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Estado</span>
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

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Descripcion</span>
          <textarea
            name="description"
            defaultValue={service.description || ""}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </>
  );
}
