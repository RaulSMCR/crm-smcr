"use client";

// Las dos salidas del visado: dejarlo en firme, o devolverlo con una
// observación.
//
// Devolver exige escribir por qué. Un cierre devuelto sin explicación deja al
// profesional adivinando y, sobre todo, deja a la persona esperando.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devolverCierre, visarCierre } from "@/actions/caso-actions";

export default function VisadoActions({ casoId }) {
  const router = useRouter();
  const [modo, setModo] = useState(null); // "visar" | "devolver"
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function ejecutar() {
    setError("");
    startTransition(async () => {
      const res =
        modo === "visar" ? await visarCierre(casoId, texto) : await devolverCierre(casoId, texto);

      if (res?.error) setError(res.error);
      else router.push("/panel/direccion-clinica");
    });
  }

  const campoClase =
    "mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-400";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-bold text-slate-900">Tu decisión</h3>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setModo("visar");
            setTexto("");
            setError("");
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            modo === "visar"
              ? "bg-emerald-700 text-white"
              : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          }`}
        >
          Visar el cierre
        </button>

        <button
          type="button"
          onClick={() => {
            setModo("devolver");
            setTexto("");
            setError("");
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            modo === "devolver"
              ? "bg-amber-700 text-white"
              : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          }`}
        >
          Devolver con observaciones
        </button>
      </div>

      {modo === "visar" ? (
        <>
          <p className="mt-4 text-sm text-slate-600">
            El cierre queda en firme y el expediente pasa a conservarse por diez años. Podés dejar
            una nota de supervisión, opcional.
          </p>
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nota de supervisión (opcional)"
            className={campoClase}
          />
        </>
      ) : null}

      {modo === "devolver" ? (
        <>
          <p className="mt-4 text-sm text-slate-600">
            El caso vuelve a estar abierto y la persona puede seguir agendando mientras tanto.
            Explicá qué falta.
          </p>
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Qué hace falta ampliar o revisar."
            className={campoClase}
          />
        </>
      ) : null}

      {error ? <p className="mt-2 text-sm font-medium text-accent-800">{error}</p> : null}

      {modo ? (
        <button
          type="button"
          onClick={ejecutar}
          disabled={isPending || (modo === "devolver" && texto.trim().length < 20)}
          className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando…" : modo === "visar" ? "Confirmar visado" : "Devolver al profesional"}
        </button>
      ) : null}
    </div>
  );
}
