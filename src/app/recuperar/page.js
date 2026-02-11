// src/app/recuperar/page.js
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState(null); // {type, text}

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ type: "error", text: data?.error || "No se pudo procesar." });
          return;
        }

        // Mensaje neutro (no filtra si el email existe)
        setMsg({
          type: "ok",
          text:
            data?.message ||
            "Si el correo existe, te enviaremos un enlace para restablecer tu contraseña.",
        });
      } catch {
        setMsg({ type: "error", text: "Error de red. Intenta de nuevo." });
      }
    });
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Recuperar contraseña</h1>
        <p className="text-sm text-gray-600 mb-4 text-center">
          Ingresá tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        {msg ? (
          <div
            className={
              "mb-4 rounded border px-3 py-2 text-sm " +
              (msg.type === "ok"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-600")
            }
          >
            {msg.text}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="bg-white border rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="tuemail@dominio.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full px-4 py-2 rounded bg-neutral-900 text-white hover:bg-neutral-950 disabled:opacity-70"
          >
            {pending ? "Enviando…" : "Enviar enlace"}
          </button>

          <div className="text-center text-sm text-gray-600">
            <Link href="/ingresar" className="underline">
              Volver a ingresar
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
