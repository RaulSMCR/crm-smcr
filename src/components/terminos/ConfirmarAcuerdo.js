"use client";

// Confirmación del acuerdo, al pie de /terminos.
//
// Se resuelve en el cliente a propósito: /terminos es pública y estática, y
// convertirla en dinámica para todo el mundo solo por quien tiene un repaso
// pendiente sería pagar caro por muy poco. Si no hay sesión, o no hay nada que
// confirmar, este componente no pinta nada.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { confirmarAcuerdo, estadoDelAcuerdo } from "@/actions/acuerdo-actions";

export default function ConfirmarAcuerdo() {
  const [estado, setEstado] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let vigente = true;
    estadoDelAcuerdo()
      .then((res) => {
        if (vigente && res?.debeAceptar) setEstado(res);
      })
      .catch(() => {
        /* Sin sesión o sin red: la página se lee igual. */
      });
    return () => {
      vigente = false;
    };
  }, []);

  function confirmar() {
    setError("");
    startTransition(async () => {
      const res = await confirmarAcuerdo();
      if (res?.error) setError(res.error);
      else setConfirmado(true);
    });
  }

  if (!estado) return null;

  if (confirmado) {
    return (
      <section className="mt-12 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950">
        <h2 className="text-lg font-bold">Gracias por tomarte el rato</h2>
        <p className="mt-2 leading-relaxed">
          Ya podés volver a reservar. Si tu agenda seguía en pausa, la administración se comunica
          con vos para coordinar el próximo turno.
        </p>
        <Link
          href="/panel/paciente"
          className="mt-4 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          Volver a mi panel
        </Link>
      </section>
    );
  }

  return (
    <section
      id="confirmar"
      className="mt-12 scroll-mt-24 rounded-2xl border border-brand-300 bg-white p-6 shadow-card"
    >
      <h2 className="text-lg font-bold text-brand-800">{estado.titulo}</h2>
      <p className="mt-2 leading-relaxed text-neutral-700">{estado.cuerpo}</p>

      <button
        type="button"
        onClick={confirmar}
        disabled={isPending}
        className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Registrando…" : estado.accion}
      </button>

      {error ? <p className="mt-2 text-sm font-medium text-accent-800">{error}</p> : null}
    </section>
  );
}
