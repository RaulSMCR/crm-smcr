"use client";

import { useState } from "react";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setMsg(null);
    const e = email.trim().toLowerCase();
    if (!e) return setMsg({ kind: "error", text: "Ingresá tu email." });

    try {
      setPending(true);
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Error");

      setMsg({ kind: "ok", text: data?.message || "Listo. Revisá tu correo." });
    } catch (err) {
      setMsg({ kind: "error", text: err?.message || "Error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded border bg-white p-6">
        <h1 className="text-xl font-bold mb-2">Recuperar contraseña</h1>
        <p className="text-sm text-gray-600 mb-4">
          Te enviaremos un enlace si tu correo está registrado.
        </p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full border rounded px-3 py-2"
          autoComplete="email"
        />

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-3 w-full px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-70"
        >
          {pending ? "Enviando…" : "Enviar enlace"}
        </button>

        {msg ? (
          <div
            className={
              "mt-3 text-sm rounded px-3 py-2 " +
              (msg.kind === "ok"
                ? "text-green-700 border border-green-200 bg-green-50"
                : "text-red-600 border border-red-200 bg-red-50")
            }
          >
            {msg.text}
          </div>
        ) : null}
      </div>
    </main>
  );
}
