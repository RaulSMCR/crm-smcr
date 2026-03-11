"use client";

import { useEffect } from "react";

export default function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const timeoutId = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timeoutId);
  }, [message, onDismiss]);

  if (!message) return null;

  const colorClass =
    type === "error"
      ? "border-accent-800 bg-accent-900 text-white"
      : "border-brand-800 bg-brand-900 text-white";

  const icon = type === "error" ? "X" : "OK";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 rounded-2xl border px-5 py-3 shadow-lg ${colorClass}`}
    >
      <span className="text-xs font-bold tracking-[0.18em]">{icon}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="ml-1 text-sm leading-none text-white/80 transition-opacity hover:opacity-100"
      >
        X
      </button>
    </div>
  );
}
