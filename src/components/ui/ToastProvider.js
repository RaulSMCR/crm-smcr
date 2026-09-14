"use client";

// src/components/ui/ToastProvider.js
//
// Un solo lugar donde avisar qué pasó, para paneles con muchas acciones.
//
// `ui/Toast` ya existía y lo usan una decena de paneles, pero cada uno se lo
// monta a mano con su propio `useState`: sirve cuando hay una acción, no cuando
// hay veinte repartidas en cinco secciones. Además, cada aviso tapaba al
// anterior, porque el componente es una sola caja fija en la esquina.
//
// Acá se apilan y se apagan solos, y `useToast()` se puede llamar desde
// cualquier profundidad sin pasar callbacks por props. `ui/Toast` queda como
// está: los paneles que ya lo usan no se tocan.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ToastContext = createContext(null);

const DURACION = { success: 4000, error: 8000, info: 5000 };

const ESTILO = {
  success: "border-brand-800 bg-brand-900 text-white",
  error: "border-accent-800 bg-accent-900 text-white",
  info: "border-slate-700 bg-slate-800 text-white",
};

const MARCA = { success: "OK", error: "X", info: "i" };

let contador = 0;

function Aviso({ toast, onCerrar }) {
  const { id, message, type, duration } = toast;

  useEffect(() => {
    // Un error no se va solo tan rápido: es lo que hay que leer, y muchas veces
    // llega mientras uno mira otra parte de la pantalla.
    const ms = duration ?? DURACION[type] ?? DURACION.info;
    if (ms === Infinity) return undefined;
    const t = setTimeout(() => onCerrar(id), ms);
    return () => clearTimeout(t);
  }, [id, type, duration, onCerrar]);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-5 py-3 shadow-lg ${ESTILO[type] || ESTILO.info}`}
    >
      <span className="mt-0.5 text-xs font-bold tracking-[0.18em]">{MARCA[type] || MARCA.info}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={() => onCerrar(id)}
        aria-label="Cerrar notificación"
        className="ml-1 text-sm leading-none text-white/80 transition-opacity hover:opacity-100"
      >
        X
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const cerrar = useCallback((id) => {
    setToasts((actuales) => actuales.filter((t) => t.id !== id));
  }, []);

  const avisar = useCallback((message, type = "success", opciones = {}) => {
    const texto = String(message || "").trim();
    if (!texto) return null;
    contador += 1;
    const id = `toast-${contador}`;
    // Tres a la vez es el límite: más que eso tapa la pantalla y deja de
    // leerse. Se descartan los más viejos, que ya tuvieron su turno.
    setToasts((actuales) => [...actuales.slice(-2), { id, message: texto, type, duration: opciones.duration }]);
    return id;
  }, []);

  const valor = useMemo(() => ({ avisar, cerrar }), [avisar, cerrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
      >
        {toasts.map((toast) => (
          <Aviso key={toast.id} toast={toast} onCerrar={cerrar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * `avisar(mensaje, tipo)` desde cualquier componente cliente bajo el provider.
 *
 * Fuera del provider devuelve una función que no hace nada en vez de reventar:
 * un aviso que no se muestra es un defecto de interfaz, no una razón para
 * tumbar la página en la que alguien estaba trabajando. Queda dicho en consola.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return {
    avisar: (mensaje, tipo) => {
      console.warn("useToast fuera de ToastProvider; el aviso no se muestra:", tipo, mensaje);
      return null;
    },
    cerrar: () => {},
  };
}
