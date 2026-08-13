"use client";

// Franjas horarias propias del profesional. Sirven para cobrar distinto según la
// hora (matutino / vespertino) sin repetir el rango en cada tarifa.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTimeBands } from "@/actions/practice-actions";
import { findTimeBandOverlaps } from "@/lib/rates";

function newBand() {
  return { id: null, key: `tmp_${Math.random().toString(36).slice(2)}`, name: "", startTime: "07:00", endTime: "13:00" };
}

export default function TimeBandsManager({ initialBands = [] }) {
  const router = useRouter();
  const [bands, setBands] = useState(() =>
    initialBands.map((band) => ({ ...band, key: band.id }))
  );
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  // Se avisa del solape mientras se escribe, sin esperar al guardado.
  const overlaps = findTimeBandOverlaps(bands);
  const overlapNames = overlaps.length > 0 ? `${overlaps[0][0].name || "sin nombre"} y ${overlaps[0][1].name || "sin nombre"}` : null;

  const setBand = (key, field, value) =>
    setBands((prev) => prev.map((band) => (band.key === key ? { ...band, [field]: value } : band)));

  const onSave = () => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await saveTimeBands(bands.map(({ key, ...band }) => band));
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "Franjas guardadas." });
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Franjas horarias</h2>
      <p className="mt-1 text-sm text-slate-600">
        Opcional. Defina sus franjas solo si cobra distinto según la hora. Sin franjas, el precio de un
        lugar rige todo el día.
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

      {overlapNames && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Las franjas <b>{overlapNames}</b> se pisan. Ajústelas: una cita en la hora compartida no sabría
          qué precio aplicar.
        </div>
      )}

      <div className="mt-4 space-y-3">
        {bands.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Sin franjas configuradas.
          </p>
        )}

        {bands.map((band) => (
          <div key={band.key} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label className="text-sm">
              <span className="font-medium text-slate-800">Nombre</span>
              <input
                type="text"
                value={band.name}
                onChange={(e) => setBand(band.key, "name", e.target.value)}
                placeholder="Matutino"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-slate-800">Desde</span>
              <input
                type="time"
                value={band.startTime}
                onChange={(e) => setBand(band.key, "startTime", e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="font-medium text-slate-800">Hasta</span>
              <input
                type="time"
                value={band.endTime}
                onChange={(e) => setBand(band.key, "endTime", e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <button
              type="button"
              onClick={() => setBands((prev) => prev.filter((item) => item.key !== band.key))}
              className="h-[42px] rounded-xl border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setBands((prev) => [...prev, newBand()])}
          className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Agregar franja
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || Boolean(overlapNames)}
          className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar franjas"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Al eliminar una franja se eliminan también sus tarifas: esas citas pasarán a cobrarse con la
        tarifa general del lugar.
      </p>
    </section>
  );
}
