//src/app/verificar-email/VerifyEmailClient.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp.get("token") || "";

  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [message, setMessage] = useState("Verificando…");

  const [emailForResend, setEmailForResend] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [resendMsg, setResendMsg] = useState(null); // {kind:"ok"|"error", text:string} | null

  const canVerify = useMemo(() => token.length > 0, [token]);

  // ✅ Ya creamos /api/auth/resend-verification
  const RESEND_ENABLED = true;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canVerify) {
        setStatus("error");
        setMessage("Token faltante. Revisá el enlace del email.");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          setStatus("error");
          setMessage(
            data?.error ||
              "No se pudo verificar el correo. El enlace puede haber expirado."
          );
          return;
        }

        setStatus("ok");
        setMessage("¡Correo verificado! Ya podés ingresar.");

        // ✅ Ruta real de login en tu proyecto
        setTimeout(() => {
          if (!cancelled) router.push("/ingresar");
        }, 1200);
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Error de red. Intentá nuevamente.");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [canVerify, token, router]);

  async function resend() {
    setResendMsg(null);

    const email = String(emailForResend || "").trim().toLowerCase();
    if (!email) {
      setResendMsg({ kind: "error", text: "Ingresá tu email para reenviar." });
      return;
    }

    try {
      setResendPending(true);

      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reenviar.");
      }

      setResendMsg({
        kind: "ok",
        text: "Si ese correo existe en el sistema, te enviamos un nuevo enlace de verificación.",
      });
    } catch (e) {
      setResendMsg({
        kind: "error",
        text: e?.message || "Error al reenviar.",
      });
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded border bg-white p-6">
      <h1 className="text-xl font-bold mb-2">Confirmación de correo</h1>

      <p className={status === "error" ? "text-red-600" : "text-gray-700"}>
        {message}
      </p>

      {status === "error" && RESEND_ENABLED ? (
        <div className="mt-4 rounded border bg-neutral-50 p-3">
          <div className="text-sm mb-2">
            Si el enlace venció, podés pedir uno nuevo:
          </div>

          <input
            type="email"
            value={emailForResend}
            onChange={(e) => setEmailForResend(e.target.value)}
            placeholder="tu@email.com"
            className="w-full border rounded px-3 py-2"
            autoComplete="email"
          />

          <button
            type="button"
            onClick={resend}
            disabled={resendPending}
            className="mt-3 w-full px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-70"
          >
            {resendPending ? "Reenviando…" : "Reenviar verificación"}
          </button>

          {resendMsg ? (
            <div
              className={
                "mt-3 text-sm rounded px-3 py-2 " +
                (resendMsg.kind === "ok"
                  ? "text-green-700 border border-green-200 bg-green-50"
                  : "text-red-600 border border-red-200 bg-red-50")
              }
            >
              {resendMsg.text}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
