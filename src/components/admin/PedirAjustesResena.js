"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/Toast";

/** Mismo tope que valida el endpoint; acá solo evita que el textarea crezca sin fin. */
export const NOTA_MAX = 1000;

/**
 * "Pedir ajustes" con la nota que el profesional va a leer. `AdminApproveButton`
 * no sirve para esto: hace un POST sin cuerpo, así que el motivo del rechazo
 * nunca podía viajar.
 */
export default function PedirAjustesResena({ endpoint }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  function cancelar() {
    setAbierto(false);
    setNota("");
  }

  async function enviar() {
    setEnviando(true);
    setToast(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: nota.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `Error ${res.status}`);
      }
      setToast({ message: "La reseña quedó marcada para ajustes.", type: "success" });
      setAbierto(false);
      setNota("");
      startTransition(() => router.refresh());
    } catch (e) {
      setToast({ message: e.message, type: "error" });
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="inline-flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded bg-rose-700 px-3 py-2 text-sm text-white hover:bg-rose-800"
        >
          Pedir ajustes
        </button>
        <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3">
      <label htmlFor={`nota-${endpoint}`} className="block text-xs font-semibold text-rose-900">
        ¿Qué necesita ajustar?
      </label>
      <p className="mt-1 text-xs text-rose-800">
        Lo que escribas acá es lo único que el profesional va a ver sobre por qué no se publicó.
      </p>

      <textarea
        id={`nota-${endpoint}`}
        value={nota}
        onChange={(e) => setNota(e.target.value.slice(0, NOTA_MAX))}
        rows={4}
        autoFocus
        placeholder="Ej: la reseña menciona diagnósticos concretos; reformulá en términos de acompañamiento y dejá el número de colegiatura al final."
        className="mt-2 w-full rounded-lg border border-rose-300 bg-white p-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
      />

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[11px] text-rose-800">
          {nota.trim()
            ? `${nota.length}/${NOTA_MAX}`
            : "Si lo dejás en blanco se envía un aviso genérico, sin indicaciones."}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="rounded bg-rose-700 px-3 py-2 text-sm text-white hover:bg-rose-800 disabled:opacity-70"
        >
          {enviando ? "Enviando..." : "Enviar solicitud de ajustes"}
        </button>
        <button
          type="button"
          onClick={cancelar}
          disabled={enviando}
          className="rounded border border-rose-300 bg-white px-3 py-2 text-sm text-rose-900 hover:bg-rose-100 disabled:opacity-70"
        >
          Cancelar
        </button>
      </div>

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
