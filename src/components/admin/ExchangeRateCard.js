"use client";

// Tipo de cambio del día.
//
// La descarga automática está de primera pero no se puede confiar en ella: el
// BCCR y el indicador de Hacienda bloquean por ubicación geográfica y las
// funciones corren en Portland. Por eso el campo de carga manual está siempre
// visible, no escondido detrás de un "modo avanzado": es el camino que se espera
// que se use a diario.

import { useState, useTransition } from "react";
import { guardarTipoCambio, intentarDescargaTipoCambio } from "@/actions/exchange-rate-actions";
import Toast from "@/components/ui/Toast";

const ETIQUETA_FUENTE = {
  BCCR: "Banco Central",
  HACIENDA: "Indicador de Hacienda",
  MANUAL: "Cargado a mano",
  FALLBACK: "Valor por defecto del sistema",
  USD_CRC_RATE: "Variable de entorno",
};

function formatFecha(valor) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(valor));
}

export default function ExchangeRateCard({ vigente, historial = [] }) {
  const [toast, setToast] = useState(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await guardarTipoCambio(fd);
      if (res?.error) setToast({ message: res.error, type: "error" });
      else setToast({ message: `Tipo de cambio guardado: ₡${res.rate}`, type: "success" });
    });
  }

  function descargar() {
    startTransition(async () => {
      const res = await intentarDescargaTipoCambio();
      if (res?.error) setToast({ message: res.error, type: "error" });
      else setToast({ message: `Descargado: ₡${res.rate}`, type: "success" });
    });
  }

  const desactualizado = !vigente?.esDeHoy;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tipo de cambio del dólar</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Convierte el cargo fijo de ONVO, que se cobra en dólares (US$0.35 por transacción con
              tarjeta). Se usa el precio de <b>venta</b>: es un costo que se paga en dólares.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">
              ₡{Number(vigente?.rate || 0).toLocaleString("es-CR")}
            </div>
            <div className="text-xs text-slate-500">
              {ETIQUETA_FUENTE[vigente?.source] || vigente?.source}
            </div>
          </div>
        </div>

        {desactualizado ? (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay un valor cargado para hoy. Se está usando un respaldo, así que las comisiones
            estimadas de hoy pueden no cuadrar con la liquidación de ONVO.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="sell" className="block text-sm font-medium text-slate-700">
              Venta
            </label>
            <input
              id="sell"
              name="sell"
              type="number"
              step="0.01"
              required
              placeholder="510.00"
              className="mt-1 w-32 rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="buy" className="block text-sm font-medium text-slate-700">
              Compra <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="buy"
              name="buy"
              type="number"
              step="0.01"
              placeholder="504.00"
              className="mt-1 w-32 rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="fecha" className="block text-sm font-medium text-slate-700">
              Día
            </label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>

          <button
            type="button"
            onClick={descargar}
            disabled={isPending}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Intentar descarga
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-500">
          El valor lo publica el BCCR todos los días hábiles. La descarga automática suele fallar:
          tanto el BCCR como el indicador de Hacienda restringen el acceso por ubicación geográfica
          y el sitio corre fuera de Costa Rica.
        </p>

        {historial.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Día</th>
                  <th className="py-2 pr-4 text-right">Venta</th>
                  <th className="py-2 pr-4 text-right">Compra</th>
                  <th className="py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={String(r.date)} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{formatFecha(r.date)}</td>
                    <td className="py-2 pr-4 text-right font-medium">
                      ₡{r.sell.toLocaleString("es-CR")}
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-600">
                      {r.buy ? `₡${r.buy.toLocaleString("es-CR")}` : "—"}
                    </td>
                    <td className="py-2 text-slate-600">{ETIQUETA_FUENTE[r.source] || r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </>
  );
}
