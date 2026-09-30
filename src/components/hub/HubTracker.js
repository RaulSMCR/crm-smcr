"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

function utmParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content"].flatMap((key) => {
    const value = params.get(key);
    return value ? [[key, value]] : [];
  }));
}

export function trackHubClick(eventName, destination) {
  trackEvent(eventName, {
    source_page: window.location.pathname,
    destination,
    ...utmParams(),
  });
}

/**
 * Clic a WhatsApp desde el hub.
 *
 * Evento propio y separado de los `click_hub_raul_*` porque es el único que se
 * va a importar a Google Ads como conversión secundaria: si compartiera nombre
 * con la navegación interna, cualquier retoque de esos enlaces movería una
 * conversión de la campaña sin que nadie lo notara.
 *
 * `tema` es el slug y `ubicacion` dónde estaba el enlace. No manda
 * `source_page`. Lo que viaja igual es `page_location`: gtag lo agrega a todo
 * evento de GA4 y quitarlo exigiría falsear el informe. Ningún dato personal ni
 * clínico sale de acá.
 *
 * @param {'hero'|'barra_movil'|'cierre'} ubicacion
 * @param {string} [tema] slug del tema; vacío en la portada
 */
export function trackWhatsappHubClick(ubicacion, tema = "") {
  trackEvent("whatsapp_click_hub_raul", {
    ubicacion,
    ...(tema ? { tema } : {}),
    ...utmParams(),
  });
}

export default function HubTracker() {
  useEffect(() => {
    trackEvent("view_hub_raul_olmedo", {
      source_page: window.location.pathname,
      ...utmParams(),
    });
  }, []);

  return null;
}
