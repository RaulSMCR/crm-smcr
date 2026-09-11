"use client";

// Escalera de precios del profesional: precios de entrada que suben a medida que
// llegan pacientes nuevos. El profesional la propone y administración la aprueba.
// Las reglas viven en src/lib/price-ladder.js.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposePriceLadder, withdrawPriceLadder } from "@/actions/price-ladder-actions";
import { LIMITES_ESCALERA } from "@/lib/price-ladder";
import { formatCRC as formatCRCBase } from "@/lib/service-pricing";
import PriceLadderTiersTable from "@/components/pricing/PriceLadderTiersTable";

// Formato compartido; este componente muestra "—" cuando no hay monto.
const formatCRC = (value) => formatCRCBase(value, { vacio: "—" });

const FILA_NUEVA = { price: "", capacity: "10" };

const ESTADOS = {
  PENDING: { texto: "En revisión", clase: "bg-amber-100 text-amber-800" },
  APPROVED: { texto: "Vigente", clase: "bg-emerald-100 text-emerald-800" },
  REJECTED: { texto: "Rechazada", clase: "bg-rose-100 text-rose-800" },
};

export default function PriceLadderManager({ escaleras = [], consultas = [] }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(consultas[0]?.serviceId || "");
  const [filas, setFilas] = useState([{ ...FILA_NUEVA }]);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const porConsulta = useMemo(() => {
    const mapa = new Map();
    for (const escalera of escaleras) {
      if (!mapa.has(escalera.serviceId)) mapa.set(escalera.serviceId, []);
      mapa.get(escalera.serviceId).push(escalera);
    }
    return mapa;
  }, [escaleras]);

  const cambiarFila = (indice, campo, valor) =>
    setFilas((previas) => previas.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));

  const agregarFila = () =>
    setFilas((previas) => (previas.length >= LIMITES_ESCALERA.escalones ? previas : [...previas, { ...FILA_NUEVA }]));

  const quitarFila = (indice) =>
    setFilas((previas) => (previas.length === 1 ? previas : previas.filter((_, i) => i !== indice)));

  const onSubmit = (event) => {
    event.preventDefault();
    setMsg({ type: "", text: "" });

    startTransition(async () => {
      const res = await proposePriceLadder({
        serviceId,
        tiers: filas.map((fila) => ({ price: Number(fila.price), capacity: Number(fila.capacity) })),
      });

      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setFilas([{ ...FILA_NUEVA }]);
      setMsg({ type: "ok", text: "Escalera enviada a revisión. Mientras tanto sigue rigiendo su precio actual." });
      router.refresh();
    });
  };

  const onWithdraw = (escalera) => {
    setMsg({ type: "", text: "" });
    startTransition(async () => {
      const res = await withdrawPriceLadder(escalera.id);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "Propuesta retirada." });
      router.refresh();
    });
  };

  if (consultas.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Escalera de precios</h2>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Necesita al menos una consulta aprobada para armar una escalera de precios.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Escalera de precios para pacientes nuevos</h2>
      <p className="mt-1 text-sm text-slate-600">
        Defina precios de entrada que suben a medida que llegan pacientes nuevos. Cada escalón rige hasta que la
        cantidad indicada de pacientes nuevos paga el adelanto de su primera cita, y quien entra en un escalón
        conserva ese precio en todas sus sesiones. Los pacientes que ya atiende siguen con su tarifa normal y, al
        completarse la escalera, rige su precio general. El público ve solo el precio vigente. Aplica sobre el precio
        general de la consulta y administración la revisa antes de activarla.
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

      {consultas.map((consulta) => {
        const lista = porConsulta.get(consulta.serviceId) || [];
        if (lista.length === 0) return null;

        return (
          <div key={consulta.serviceId} className="mt-5">
            <h3 className="text-sm font-semibold text-slate-800">
              {consulta.title}{" "}
              <span className="font-normal text-slate-500">· precio general {formatCRC(consulta.precioGeneral)}</span>
            </h3>

            {lista.map((escalera) => {
              const estado = ESTADOS[escalera.status] || { texto: escalera.status, clase: "bg-slate-100 text-slate-700" };
              return (
                <div key={escalera.id} className="mt-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                    {escalera.status === "PENDING" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onWithdraw(escalera)}
                        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Retirar propuesta
                      </button>
                    )}
                  </div>
                  {escalera.adminReviewNote && (
                    <p className="mt-2 text-xs text-slate-500">Nota de administración: {escalera.adminReviewNote}</p>
                  )}
                  <div className="mt-2 overflow-x-auto">
                    <PriceLadderTiersTable escalera={escalera} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <form onSubmit={onSubmit} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
        <label className="block text-sm">
          <span className="font-medium text-slate-800">Consulta</span>
          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 sm:max-w-sm"
            required
          >
            {consultas.map((consulta) => (
              <option key={consulta.serviceId} value={consulta.serviceId}>
                {consulta.title}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          {filas.map((fila, indice) => (
            <div key={indice} className="grid gap-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end">
              <span className="text-sm font-semibold text-slate-700">Escalón {indice + 1}</span>
              <label className="text-sm">
                <span className="font-medium text-slate-800">Precio (colones)</span>
                <input
                  type="number"
                  min="1"
                  step="500"
                  required
                  value={fila.price}
                  onChange={(event) => cambiarFila(indice, "price", event.target.value)}
                  placeholder="30000"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-800">Pacientes nuevos a ese precio</span>
                <input
                  type="number"
                  min="1"
                  max={LIMITES_ESCALERA.cupos}
                  step="1"
                  required
                  value={fila.capacity}
                  onChange={(event) => cambiarFila(indice, "capacity", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <button
                type="button"
                disabled={filas.length === 1}
                onClick={() => quitarFila(indice)}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        {filas.length < LIMITES_ESCALERA.escalones && (
          <button
            type="button"
            onClick={agregarFila}
            className="text-sm font-semibold text-brand-800 hover:text-brand-900 hover:underline"
          >
            Agregar escalón
          </button>
        )}

        <div>
          <button
            type="submit"
            disabled={isPending || !serviceId}
            className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Enviando..." : "Enviar escalera a revisión"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Si ya hay una propuesta en revisión para esa consulta, esta la reemplaza. Aprobar una escalera nueva cierra
            la vigente, y quienes entraron en ella conservan su precio.
          </p>
        </div>
      </form>
    </section>
  );
}
