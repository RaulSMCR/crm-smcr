"use client";

// Banner de consentimiento de cookies (LEG-01). Discreto, accesible y sin dark
// patterns: "Aceptar" y "Rechazar" tienen el mismo peso visual. Al decidir,
// actualiza Google Consent Mode v2 y guarda la decisión (cookie + localStorage).
// Si ya hay una decisión, no se muestra.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";

function updateConsentMode(granted) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const v = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: v,
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
  });
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const acceptRef = useRef(null);

  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);

  // Enfoca el banner al aparecer para que sea usable con teclado.
  useEffect(() => {
    if (visible) acceptRef.current?.focus();
  }, [visible]);

  function decide(granted) {
    updateConsentMode(granted);
    setConsent(granted ? "granted" : "denied");
    setVisible(false);
  }

  function onKeyDown(e) {
    // Escape = rechazar (opción que preserva la privacidad).
    if (e.key === "Escape") decide(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Aviso de cookies"
      onKeyDown={onKeyDown}
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-neutral-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-neutral-700">
          Usamos cookies para entender cómo se usa el sitio y mejorar tu experiencia.
          Podés aceptarlas o rechazarlas.{" "}
          <Link
            href="/cookies"
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded"
          >
            Más información
          </Link>
          .
        </p>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide(false)}
            className="flex-1 rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:flex-none"
          >
            Rechazar
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => decide(true)}
            className="flex-1 rounded-lg border border-brand-600 bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-brand-500 hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:flex-none"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
