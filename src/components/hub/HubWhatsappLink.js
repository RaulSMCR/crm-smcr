"use client";

import { trackWhatsappHubClick } from "@/components/hub/HubTracker";

/**
 * El enlace a WhatsApp del hub, con su propio evento de GA4.
 *
 * Tiene componente propio porque este clic es el que se importa a Google Ads:
 * conviene que su evento y sus parámetros (`tema`, `ubicacion`) estén en un
 * solo lugar y no dependan del nombre que le pase cada página.
 *
 * `target` y `rel` van fijos acá por la misma razón: un `rel` olvidado en una de
 * las cuatro superficies es una fuga de `window.opener`.
 */
export default function HubWhatsappLink({ ubicacion, tema = "", onClick, ...props }) {
  function handleClick(event) {
    trackWhatsappHubClick(ubicacion, tema);
    onClick?.(event);
  }

  return <a {...props} target="_blank" rel="noopener noreferrer" onClick={handleClick} />;
}
