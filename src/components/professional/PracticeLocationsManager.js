"use client";

// Lugares donde el profesional atiende. Cada uno puede tener su propia tarifa,
// y el paciente elige entre ellos al agendar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePracticeLocation, deletePracticeLocation } from "@/actions/practice-actions";
import { modalityLabel } from "@/lib/rates";

const MODALITIES = ["OFFICE", "HOME", "VIRTUAL"];

const EMPTY = { id: null, name: "", modality: "OFFICE", address: "", instructions: "", isActive: true };

export default function PracticeLocationsManager({ initialLocations = [] }) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const isEditing = Boolean(form.id);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const onSubmit = (event) => {
    event.preventDefault();
    setMsg({ type: "", text: "" });

    startTransition(async () => {
      const res = await savePracticeLocation(form);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setForm(EMPTY);
      setMsg({ type: "ok", text: isEditing ? "Lugar actualizado." : "Lugar agregado." });
      router.refresh();
    });
  };

  const onDelete = (location) => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await deletePracticeLocation(location.id);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      if (form.id === location.id) setForm(EMPTY);
      setMsg({ type: "ok", text: "Lugar eliminado." });
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Dónde atiende</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cargue cada lugar en el que atiende. El paciente elegirá entre ellos al agendar y cada uno
        puede tener un precio distinto.
      </p>

      {msg.text && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            msg.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      {initialLocations.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {initialLocations.map((location) => (
            <li key={location.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{location.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {modalityLabel(location.modality)}
                  </span>
                  {!location.isActive && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Inactivo
                    </span>
                  )}
                </div>
                {location.address && <div className="mt-1 text-sm text-slate-600">{location.address}</div>}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...EMPTY, ...location, address: location.address || "", instructions: location.instructions || "" })}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onDelete(location)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-800">Nombre visible</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Consultorio Escazú"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-slate-800">Modalidad</span>
          <select
            value={form.modality}
            onChange={(e) => setField("modality", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            {MODALITIES.map((modality) => (
              <option key={modality} value={modality}>
                {modalityLabel(modality)}
              </option>
            ))}
          </select>
        </label>

        {form.modality === "OFFICE" && (
          <label className="text-sm sm:col-span-2">
            <span className="font-medium text-slate-800">Dirección</span>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setField("address", e.target.value)}
              placeholder="San Rafael de Escazú, Edificio Torre A, piso 3"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        )}

        <label className="text-sm sm:col-span-2">
          <span className="font-medium text-slate-800">
            {form.modality === "VIRTUAL" ? "Enlace o instrucciones de conexión" : "Indicaciones para llegar"}
          </span>
          <textarea
            value={form.instructions}
            onChange={(e) => setField("instructions", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-800 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
            className="h-4 w-4"
          />
          Disponible para agendar
        </label>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Guardando..." : isEditing ? "Guardar cambios" : "Agregar lugar"}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => setForm(EMPTY)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
