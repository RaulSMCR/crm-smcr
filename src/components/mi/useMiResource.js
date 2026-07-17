"use client";

// Hook de datos para las tabs de /mi. Hace fetch a un endpoint /api/mi/*
// (network-only: el service worker nunca cachea /api/*). Maneja carga, error y
// sesión expirada (401), y expone reload() para reintentar.
import { useCallback, useEffect, useState } from "react";

export function useMiResource(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });

      if (res.status === 401) {
        setState({ data: null, error: "Tu sesión expiró. Ingresá de nuevo.", loading: false });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setState({ data, error: null, loading: false });
    } catch {
      setState({
        data: null,
        error: "No pudimos cargar la información. Revisá tu conexión.",
        loading: false,
      });
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
