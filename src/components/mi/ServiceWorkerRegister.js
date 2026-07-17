"use client";

// Registra el service worker de la PWA de pacientes con scope /mi.
// El script vive en /mi-sw.js (raíz de public/), cuyo scope máximo por defecto
// es "/", así que acotarlo a "/mi" es válido sin cabecera Service-Worker-Allowed.
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/mi-sw.js", { scope: "/mi" })
        .catch((err) => console.error("[mi-sw] registro falló:", err));
    };

    if (document.readyState === "complete") {
      register();
      return undefined;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
