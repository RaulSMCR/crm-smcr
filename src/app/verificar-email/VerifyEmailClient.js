// src/app/verificar-email/VerifyEmailClient.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyEmailClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const token = sp.get("token") || "";

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verificando su correo para continuar con acceso seguro...");

  const [emailForResend, setEmailForResend] = useState("");
  const [resendPending, setResendPending] = useState(false);
  const [resendMsg, setResendMsg] = useState(null);

  const canVerify = useMemo(() => token.length > 0, [token]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canVerify) {
        setStatus("error");
        setMessage("Token faltante. Revise el enlace enviado por correo para continuar.");
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
          setMessage(data?.error || "No fue posible verificar el correo. El enlace podría haber expirado.");
          return;
        }

        setStatus("ok");
        setMessage("Correo verificado con éxito. Ya puede ingresar.");

        setTimeout(() => {
          if (!cancelled) router.push("/ingresar");
        }, 1200);
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Error de red. Por favor, intente nuevamente.");
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
      setResendMsg({ kind: "error", text: "Ingrese su correo para reenviar el enlace." });
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
        text: "Si el correo existe en el sistema, se enviará un nuevo enlace de verificación.",
      });
    } catch (e) {
      setResendMsg({ kind: "error", text: e?.message || "No fue posible reenviar el enlace." });
    } finally {
      setResendPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded border bg-white p-6">
      <h1 className="text-xl font-bold mb-2">Confirmación de correo</h1>

      <p className={status === "error" ? "text-red-600" : "text-gray-700"}>{message}</p>

      {status === "error" ? (
        <div className="mt-4 rounded border bg-neutral-50 p-3">
          <div className="text-sm mb-2">Si el enlace venció, puede solicitar uno nuevo:</div>

          <input
            type="email"
            value={emailForResend}
            onChange={(e) => setEmailForResend(e.target.value)}
            placeholder="correo@dominio.com"
            className="w-full border rounded px-3 py-2"
            autoComplete="email"
          />

          <button
            type="button"
            onClick={resend}
            disabled={resendPending}
            className="mt-3 w-full px-4 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-900 disabled:opacity-70"
          >
            {resendPending ? "Enviando..." : "Reenviar enlace"}
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
