"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureMarketingAttribution } from "@/lib/marketing-attribution-client";
import { captureAdIdentifiers } from "@/lib/analytics/client-identifiers";

// Áreas privadas donde NO tiene sentido capturar atribución de marketing.
const EXCLUDED = [/^\/panel(\/|$)/, /^\/ingresar$/];

export default function MarketingAttributionCapture() {
  const pathname = usePathname();

  useEffect(() => {
    if (EXCLUDED.some((re) => re.test(pathname || ""))) return;
    // First-touch: es idempotente, así que correr en cada navegación pública
    // no sobrescribe; solo captura si aún no hay atribución vigente.
    captureMarketingAttribution();
    captureAdIdentifiers();
  }, [pathname]);

  return null;
}
