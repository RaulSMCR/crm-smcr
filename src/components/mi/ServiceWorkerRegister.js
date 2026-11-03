"use client";

// Registra el service worker de una PWA: por defecto la de pacientes (/mi); la
// de profesionales pasa src="/pro-sw.js" y scope="/pro". Los scripts viven en
// la raíz de public/, cuyo scope máximo por defecto es "/", así que acotarlos a
// su prefijo es válido sin cabecera Service-Worker-Allowed.
import { useEffect } from "react";

export default function ServiceWorkerRegister({ src = "/mi-sw.js", scope = "/mi" }) {
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
        .register(src, { scope })
        .catch((err) => console.error(`[${src}] registro falló:`, err));
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
  }, [src, scope]);

  return null;
}
