"use client";

import { useEffect } from "react";

/**
 * Toast de notificación fijo en pantalla.
 * Se auto-descarta a los 3.5 segundos.
 *
 * Props:
 *   message  – texto a mostrar (null/undefined = oculto)
 *   type     – "success" | "error"
 *   onDismiss – callback para limpiar el estado del padre
 */
export default function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  const colorClass =
    type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const icon = type === "error" ? "✕" : "✓";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 shadow-lg ${colorClass}`}
    >
      <span className="text-base font-semibold leading-none">{icon}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="ml-1 text-sm leading-none opacity-50 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
