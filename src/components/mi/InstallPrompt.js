"use client";

// Banner de instalación de la PWA. Captura beforeinstallprompt (cuando el
// navegador lo ofrece), soporta iOS/Safari con instrucciones, y es dismissible:
// tras cerrarlo no reaparece por 7 días (localStorage).
//
// variant="mi"      → se muestra en /mi a partir de la 2ª visita (montado en el
//                     layout de /mi para capturar el evento en toda el área).
// variant="booking" → nudge inmediato tras reservar (pantalla /panel/paciente
//                     con ?created=1). Esa ruta no enlaza el manifest, así que
//                     no hay prompt nativo: cae en iOS-instrucciones o puente a /mi.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const DISMISS_KEY = "mi_install_dismissed_at";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
function dismissedRecently() {
  const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return ts > 0 && Date.now() - ts < WEEK_MS;
}

function ShareIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="inline-block align-text-bottom" aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m8 8 4-4 4 4" />
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
function AddIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="inline-block align-text-bottom" aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

export default function InstallPrompt({ variant = "mi" }) {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone()) return undefined;

    // Puede haberse capturado antes de montar (ver ServiceWorkerRegister).
    if (window.__miDeferredInstallPrompt) setDeferred(window.__miDeferredInstallPrompt);

    const onBeforeInstall = (event) => {
      event.preventDefault();
      window.__miDeferredInstallPrompt = event;
      setDeferred(event);
    };
    const onReady = () => {
      if (window.__miDeferredInstallPrompt) setDeferred(window.__miDeferredInstallPrompt);
    };
    const onInstalled = () => {
      window.__miDeferredInstallPrompt = null;
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setEligible(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("mi:installprompt-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);

    setIos(isIOSDevice());

    // Se ofrece desde la 1ª visita (el paciente pidió que se ofrezca), pero sigue
    // siendo dismissible: tras cerrarlo no reaparece por 7 días.
    setEligible(!dismissedRecently());

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("mi:installprompt-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [variant]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setEligible(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* el usuario canceló */
    }
    window.__miDeferredInstallPrompt = null;
    setDeferred(null);
    setEligible(false);
  }

  if (!eligible) return null;
  if (variant === "mi" && pathname !== "/mi") return null;

  const canNative = !!deferred;
  // En /mi sin prompt nativo y sin iOS no hay forma de instalar: no molestamos.
  if (!canNative && !ios && variant !== "booking") return null;

  const copy =
    variant === "booking"
      ? "Instalá la app para recibir el recordatorio de tu cita."
      : "Instalá la app. Tu bitácora, a un toque.";

  return (
    <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-brand-900">{copy}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="-mt-1 shrink-0 rounded p-1 text-lg leading-none text-neutral-400 transition-colors hover:text-neutral-600"
        >
          ×
        </button>
      </div>

      {canNative ? (
        <button
          type="button"
          onClick={install}
          className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          Llevar la app conmigo
        </button>
      ) : ios ? (
        <p className="mt-2 text-xs leading-relaxed text-brand-800">
          En Safari, tocá <ShareIcon /> <strong>Compartir</strong> y luego{" "}
          <AddIcon /> <strong>Agregar a inicio</strong>.
        </p>
      ) : (
        <Link
          href="/mi"
          className="mt-3 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          Abrir mi espacio
        </Link>
      )}
    </div>
  );
}
