"use client";

// Adenda a un caso ya cerrado.
//
// Es el único mecanismo de corrección que tiene el expediente. Nada de lo ya
// escrito se toca: se agrega debajo, con fecha. Un expediente cuya historia se
// puede reescribir deja de ser prueba de nada.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agregarAdenda } from "@/actions/caso-actions";

export default function AdendaForm({ casoId }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await agregarAdenda(casoId, texto);
      if (res?.error) {
        setError(res.error);
      } else {
        setTexto("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={enviar}>
      <label className="mb-1 block text-sm font-semibold text-slate-800">Agregar una adenda</label>
      <textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Qué corrige o amplía, y por qué."
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-400"
      />

      {error ? <p className="mt-1 text-sm font-medium text-accent-800">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || texto.trim().length < 20}
        className="mt-3 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Guardando…" : "Guardar adenda"}
      </button>
    </form>
  );
}
