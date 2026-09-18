"use client";

// Qué ve alguien cuando una pantalla se rompe.
//
// La app no tenía ningún error boundary. Sin uno, cualquier excepción al
// renderizar deja la pantalla cruda de Next —«this page couldn't load»— que no
// dice qué pasó, no ofrece salida y, sobre todo, no distingue «se rompió algo
// nuestro» de «lo que hiciste no se guardó». El 2026-09-18 un paciente terminó
// ahí justo después de reservar, sin forma de saber si su cita existía.
//
// Por eso las dos frases de abajo importan más que el diseño: reintentar, y que
// lo hecho probablemente esté hecho. Quien acaba de reservar y ve una pantalla
// de error asume que perdió la reserva y vuelve a reservar; ahí es donde se
// fabrican las citas duplicadas.

import { useEffect } from "react";

export default function Error({ error }) {
  useEffect(() => {
    // Sale por la consola del navegador y, en el render del servidor, por los
    // logs de Vercel. `digest` es lo único que cruza los dos lados: es la llave
    // para encontrar la excepción real, que Next no manda al cliente.
    console.error("[error-boundary]", { digest: error?.digest, message: error?.message });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-slate-900">Esta pantalla no se pudo mostrar</h1>

      <p className="text-slate-600">
        Fue un problema nuestro al dibujar la página, no algo que hayas hecho mal. Si venías de
        guardar algo o de agendar una cita, lo más probable es que haya quedado registrado: antes
        de repetirlo, revisá tu panel.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Reintentar
        </button>
        {/* Una navegación completa descarta el árbol de React que falló. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/panel"
          className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Ir a mi panel
        </a>
      </div>

      {error?.digest ? (
        <p className="text-xs text-slate-400">
          Si escribís para reportarlo, pasá esta referencia: <code>{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
