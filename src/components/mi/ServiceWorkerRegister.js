"use client";

// Registra el service worker de la PWA de pacientes con scope /mi.
// El script vive en /mi-sw.js (raíz de public/), cuyo scope máximo por defecto
// es "/", así que acotarlo a "/mi" es válido sin cabecera Service-Worker-Allowed.
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Captura beforeinstallprompt lo antes posible y lo guarda en window: el
    // evento puede dispararse antes de que monte InstallPrompt, y si no se
    // atrapa, se pierde (no hay forma de volver a pedirlo). InstallPrompt lo lee
    // desde acá (window.__miDeferredInstallPrompt) además de su propio listener.
    const onBeforeInstall = (event) => {
      event.preventDefault();
      window.__miDeferredInstallPrompt = event;
      window.dispatchEvent(new Event("mi:installprompt-ready"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const register = () => {
      navigator.serviceWorker
        .register("/mi-sw.js", { scope: "/mi" })
        .catch((err) => console.error("[mi-sw] registro falló:", err));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
