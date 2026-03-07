// src/app/panel/mock/checkout/[requestId]/page.js
// Página de checkout simulado para testing sin credenciales PlacetoPay reales.
// Accesible sin autenticación (como lo sería un checkout real externo).
// Solo disponible cuando PLACETOPAY_MOCK=true.

import { getSession } from "@/lib/placetopay/mock-store";
import MockCheckoutClient from "./client";

export const dynamic = "force-dynamic";

export default function MockCheckoutPage({ params }) {
  const requestId = String(params?.requestId || "");

  if (process.env.PLACETOPAY_MOCK !== "true") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-sm">
          <p className="text-2xl mb-2">🔒</p>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Modo mock deshabilitado</h1>
          <p className="text-sm text-slate-500">
            Esta página solo está disponible cuando{" "}
            <code className="bg-slate-100 px-1 rounded">PLACETOPAY_MOCK=true</code>.
          </p>
        </div>
      </div>
    );
  }

  const session = getSession(requestId);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-sm">
          <p className="text-2xl mb-2">⏱️</p>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">Sesión no encontrada</h1>
          <p className="text-sm text-slate-500">
            La sesión de pago expiró o el servidor fue reiniciado.
            <br />
            Vuelva al inicio e intente nuevamente.
          </p>
          <a
            href="/"
            className="mt-5 inline-block text-sm text-blue-600 hover:underline"
          >
            ← Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  return <MockCheckoutClient session={session} requestId={requestId} />;
}
