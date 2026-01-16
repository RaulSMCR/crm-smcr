"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit() {
    setMsg(null);

    if (!token) return setMsg({ kind: "error", text: "Token faltante." });
    if (!p1 || p1.length < 8) return setMsg({ kind: "error", text: "Mínimo 8 caracteres." });
    if (p1 !== p2) return setMsg({ kind: "error", text: "Las contraseñas no coinciden." });

    try {
      setPending(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: p1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "No se pudo actualizar.");

      setMsg({ kind: "ok", text: data?.message || "Contraseña actualizada." });
      setTimeout(() => router.push("/login"), 1200);
    } catch (e) {
      setMsg({ kind: "error", text: e?.message || "Error" });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded border bg-white p-6">
        <h1 className="text-xl font-bold mb-2">Nueva contraseña</h1>

        <input
          type="password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          placeholder="Nueva contraseña"
          className="w-full border rounded px-3 py-2"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          placeholder="Repetir contraseña"
          className="mt-3 w-full border rounded px-3 py-2"
          autoComplete="new-password"
        />

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-3 w-full px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-70"
        >
          {pending ? "Actualizando…" : "Actualizar contraseña"}
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
