"use client";

// Aviso al paciente de que su agenda quedó en pausa.
//
// La primera vez lleva un botón para pedir que lo contacten. El público al que
// esto le llega en general nunca llevó un proceso con un profesional de salud
// mental: ante un cobro inesperado y una agenda cerrada, lo más fácil es no
// volver. El botón existe para que levantar la mano cueste menos que abandonar.
//
// A la segunda no aparece: ahí la regla ya se conoce y el contacto lo inicia la
// administración.

import { useState, useTransition } from "react";
import { solicitarContactoDeAdmin } from "@/actions/scheduling-block-actions";

export default function PausedScheduleNotice({ motivo, esPrimeraVez }) {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function pedirContacto() {
    setError("");
    startTransition(async () => {
      const res = await solicitarContactoDeAdmin();
      if (res?.error) setError(res.error);
      else setEnviado(true);
    });
  }

  return (
    <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
      <h2 className="font-semibold">Tu agenda está en pausa</h2>
      <p className="mt-1 text-sm">
        {motivo}. Por eso ahora no podés agendar ni mover citas por este medio.
      </p>

      {enviado ? (
        <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-sm font-medium">
          Listo, avisamos. La administración se comunica con vos para coordinar tu próximo turno.
        </p>
      ) : esPrimeraVez ? (
        <>
          <p className="mt-2 text-sm">
            Si querés seguir, escribinos y coordinamos tu próxima cita. Un tropiezo no termina un
            proceso.
          </p>
          <button
            type="button"
            onClick={pedirContacto}
            disabled={isPending}
            className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
          >
            {isPending ? "Enviando..." : "Pedí que te contactemos"}
          </button>
          {error ? <p className="mt-2 text-sm font-medium">{error}</p> : null}
        </>
      ) : (
        <p className="mt-2 text-sm">
          <b>La administración se pone en contacto con vos</b> para coordinar tu próximo turno.
        </p>
      )}
    </div>
  );
}
