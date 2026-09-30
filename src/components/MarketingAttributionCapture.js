"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { captureMarketingAttribution } from "@/lib/marketing-attribution-client";
import { captureAdIdentifiers } from "@/lib/analytics/client-identifiers";
import { getConsent, onConsentChange } from "@/lib/consent";

// Áreas privadas donde NO tiene sentido capturar atribución de marketing.
const EXCLUDED = [/^\/panel(\/|$)/, /^\/ingresar$/];

export default function MarketingAttributionCapture() {
  const pathname = usePathname();
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setGranted(getConsent() === "granted");
    return onConsentChange((value) => setGranted(value === "granted"));
  }, []);

  useEffect(() => {
    if (EXCLUDED.some((re) => re.test(pathname || ""))) return;
    // Sin consentimiento no se escribe nada en el dispositivo.
    //
    // Estas dos funciones guardan los UTM y el `gclid` en `localStorage`, y lo
    // hacían en toda visita, incluida la de quien había pulsado «Rechazar». El
    // banner existe para decidir exactamente eso, así que no gobernar esto era
    // tener un banner decorativo: se le preguntaba y la respuesta no cambiaba
    // nada. Ahora la respuesta manda.
    //
    // Lo que se pierde al rechazar es la atribución entre visitas. La de la
    // misma visita sobrevive sin almacenar nada: el `gclid` viaja en la URL
    // hasta la reserva (ver `HubAgendaLink`), y la conversión de la reserva
    // pagada se envía desde el servidor, que no depende de esto.
    if (!granted) return;

    // First-touch: es idempotente, así que correr en cada navegación pública
    // no sobrescribe; solo captura si aún no hay atribución vigente.
    captureMarketingAttribution();
    captureAdIdentifiers();
  }, [pathname, granted]);

  return null;
}
