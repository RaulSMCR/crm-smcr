"use client";

import { useState } from "react";

export default function MockCheckoutClient({ session, requestId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const amount = new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: session.currency || "CRC",
    maximumFractionDigits: 0,
  }).format(Number(session.amount || 0));

  async function handleOutcome(outcome) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mock/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, outcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error procesando pago simulado.");
      // Redirigir al returnUrl de la sesión
      window.location.href = data.returnUrl || "/";
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        {/* Banner de advertencia */}
        <div className="bg-amber-400 px-6 py-3 flex items-center gap-2">
          <span className="text-lg">🧪</span>
          <span className="text-sm font-semibold text-amber-900">
            ENTORNO DE PRUEBAS — No se realizan cobros reales
          </span>
        </div>

        <div className="p-7">
          {/* Logotipo simulado */}
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-full tracking-wider">
              PASARELA SIMULADA
            </div>
          </div>

          {/* Detalles del pago */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">Descripción</span>
              <span className="font-medium text-slate-800 text-right">{session.description}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">Referencia</span>
              <span className="font-mono text-slate-700 text-right break-all">{session.reference}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-800">Total a pagar</span>
              <span className="text-lg font-bold text-blue-700">{amount}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-3">
            <button
              onClick={() => handleOutcome("APPROVED")}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Procesando...
                </span>
              ) : (
                "✅ Simular Pago Aprobado"
              )}
            </button>

            <button
              onClick={() => handleOutcome("REJECTED")}
              disabled={loading}
              className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Procesando..." : "❌ Simular Pago Rechazado"}
            </button>

            <button
              onClick={() => window.history.back()}
              disabled={loading}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
            >
              ← Cancelar y volver
            </button>
          </div>

          <p className="text-xs text-center text-slate-400 mt-5">
            ID de sesión: <span className="font-mono">{requestId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
