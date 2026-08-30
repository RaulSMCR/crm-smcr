"use client";

/**
 * Botón de impresión del contrato. El navegador imprime a PDF, así que no hace
 * falta ninguna librería de generación de documentos —ni el gasto fijo que
 * traería— para que el admin se lleve el contrato listo para firmar.
 */
export default function ContratoAcciones() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-brand-500"
    >
      Imprimir o guardar como PDF
    </button>
  );
}
