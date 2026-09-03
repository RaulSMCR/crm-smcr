"use client";

import { useState } from "react";

/**
 * Umbral de caracteres a partir del cual damos por hecho que el texto no entra
 * en cuatro líneas. Es una estimación deliberada: medir el nodo real obligaría a
 * un efecto de layout por cada profesional de la lista, y el costo de
 * equivocarse es un botón "Ver completa" que no hacía falta.
 */
const LARGO_QUE_NO_ENTRA = 260;

export default function ResenaExpandible({ texto }) {
  const [abierta, setAbierta] = useState(false);
  const puedeExpandirse = texto.length > LARGO_QUE_NO_ENTRA;
  const recortada = puedeExpandirse && !abierta;

  return (
    <div className="mt-3">
      <p className={`whitespace-pre-line text-sm text-slate-700 ${recortada ? "line-clamp-4" : ""}`}>
        {texto}
      </p>

      {puedeExpandirse ? (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="mt-2 text-xs font-semibold text-brand-800 underline underline-offset-2 hover:text-brand-900"
        >
          {abierta ? "Ver menos" : `Ver reseña completa (${texto.length} caracteres)`}
        </button>
      ) : null}
    </div>
  );
}
