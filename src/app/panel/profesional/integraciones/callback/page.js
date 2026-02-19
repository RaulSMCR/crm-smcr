// src/app/panel/profesional/integraciones/callback/page.js
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { guardarCredencialesGoogle } from "@/actions/google-connect-actions";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Procesando conexión con Google...");
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (processed) return;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("Error: Acceso denegado por el usuario.");
      setTimeout(() => router.push("/panel/profesional"), 2000);
      return;
    }
    if (!code) return;

    (async () => {
      setProcessed(true);
      const result = await guardarCredencialesGoogle(code);

      if (result?.success) {
        setStatus("¡Conexión exitosa! Redirigiendo...");
        router.push("/panel/profesional");
        router.refresh();
      } else {
        setStatus("Error: " + (result?.error || "Fallo desconocido"));
      }
    })();
  }, [processed, router, searchParams]);

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-xl font-semibold">{status}</h1>
      <p className="text-slate-500 mt-2">No cierres esta ventana.</p>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
