// PATH: src/app/cambiar-password/ResetPasswordClient.js
"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/reset-password-actions";

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => sp.get("token") || "", [sp]);
  const [pending, startTransition] = useTransition();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState(null); // {type:"ok"|"error", text}

  const tokenMissing = !token;

  function onSubmit(e) {
    e.preventDefault();
    setMsg(null);

    const fd = new FormData();
    fd.append("token", token);
    fd.append("password", password);
    fd.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      const res = await resetPassword(fd);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: res?.message || "Listo." });
      setTimeout(() => router.push("/ingresar"), 900);
    });
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Crear nueva contraseña</h1>

        {tokenMissing ? (
          <div className="mb-4 rounded border bg-red-50 border-red-200 text-red-700 px-3 py-2 text-sm">
            Token faltante. Pedí un enlace nuevo en{" "}
            <Link href="/recuperar" className="underline">
              /recuperar
            </Link>
            .
          </div>
        ) : null}

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
            <label className="block text-sm font-medium mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              disabled={tokenMissing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirmar contraseña</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              disabled={tokenMissing}
            />
          </div>

          <button
            type="submit"
            disabled={pending || tokenMissing}
            className="w-full px-4 py-2 rounded bg-neutral-900 text-white hover:bg-neutral-950 disabled:opacity-70"
          >
            {pending ? "Guardando…" : "Guardar contraseña"}
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
