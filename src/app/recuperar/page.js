// PATH: src/app/recuperar/page.js
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/reset-password-actions";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState(null); // {type:"ok"|"error", text:string}

  function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    const fd = new FormData();
    fd.append("email", email);

    startTransition(async () => {
      const res = await requestPasswordReset(fd);
      if (res?.error) setMsg({ type: "error", text: res.error });
      else setMsg({ type: "ok", text: res?.message || "Listo." });
    });
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Recuperar contraseña</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Ingresá tu correo y te enviaremos un enlace.
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
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="tu@email.com"
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
