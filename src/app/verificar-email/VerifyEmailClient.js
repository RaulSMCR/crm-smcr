// src/app/verificar-email/VerifyEmailClient.js
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token");

  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [message, setMessage] = useState("Verificando…");

  useEffect(() => {
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Token faltante.");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || "No se pudo verificar el correo.");
        }

        setStatus("ok");
        setMessage("¡Correo verificado! Ya podés iniciar sesión.");

        setTimeout(() => {
          router.push("/login");
        }, 1200);
      } catch (e) {
        setStatus("error");
        setMessage(e?.message || "Token inválido o expirado.");
      }
    }

    run();
  }, [token, router]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded border bg-white p-6">
        <h1 className="text-xl font-bold mb-2">Confirmación de correo</h1>

        <p className={status === "error" ? "text-red-600" : "text-gray-700"}>
          {message}
        </p>

        {status === "error" ? (
          <div className="mt-4 text-sm text-gray-600">
            Podés intentar registrarte de nuevo o pedir reenvío del correo
            (lo agregamos en el próximo paso).
          </div>
        ) : null}
      </div>
    </main>
  );
}
