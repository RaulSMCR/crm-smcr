"use client";

// Formulario para pedir de nuevo el enlace de verificación.
//
// Existe porque el aviso que recibe quien se registra cuando el correo no sale
// dice: «solicite reenvío del enlace desde la pantalla de verificación». Sin
// esto, esa pantalla no tenía forma de solicitar nada — mandaba a usar el enlace
// del correo que justamente no llegó.

import { useState } from "react";

export default function ReenviarVerificacion() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    setAviso(null);

    if (!email.trim()) {
      setAviso({ tipo: "error", texto: "Escribí el correo con el que te registraste." });
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      // La respuesta del endpoint es neutra a propósito: no confirma ni niega que
      // el correo exista, para que nadie pueda usar este formulario como una
      // lista de quién está registrado.
      setAviso({
        tipo: "ok",
        texto: "Si ese correo tiene una cuenta sin verificar, te llega un enlace nuevo en unos minutos. Revisá también el correo no deseado.",
      });
    } catch {
      setAviso({ tipo: "error", texto: "No pudimos enviarlo ahora. Probá de nuevo en un rato." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 text-left">
      <label htmlFor="correo-reenvio" className="block text-sm font-medium text-gray-700">
        Tu correo
      </label>
      <input
        id="correo-reenvio"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nombre@correo.com"
        autoComplete="email"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
      />

      <button
        type="submit"
        disabled={enviando}
        className="btn btn-accent mt-3 w-full py-3 disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </button>

      {aviso ? (
        <p
          className={`mt-3 text-sm ${aviso.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {aviso.texto}
        </p>
      ) : null}
    </form>
  );
}
