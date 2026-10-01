// Diagnóstico de la configuración fiscal del despliegue.
//
// GET /api/admin/fe-config
// Auth: ADMIN
//
// Responde QUÉ variables faltan y qué reglas no se cumplen, nunca con qué
// valor. Es la contraparte de una decisión deliberada del módulo de emisión:
// cuando la configuración falla, `submitInvoiceToFe` reduce el error a
// `FE_ERROR_NO_CLASIFICADO` para no publicar un texto que podría arrastrar
// datos del comprobante. Eso dejaba una factura trabada sin pista de cuál de
// las veintiuna variables era, y la única salida era cotejarlas a mano.
//
// La regla que no se negocia: acá solo salen NOMBRES. Ni valores, ni prefijos,
// ni longitudes, ni «empieza con». Un nombre arregla un despliegue; un valor
// filtra una credencial de Hacienda o el PIN del certificado.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guards";
import { diagnosticarFeConfig } from "@/lib/fe/config";

export const dynamic = "force-dynamic";

/** Nombres de las variables de esta lista que están vacías o sin definir. */
function faltantes(nombres) {
  return nombres.filter((nombre) => !String(process.env[nombre] || "").trim());
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const fiscal = diagnosticarFeConfig();

    // No son de Hacienda, pero sin ellas el comprobante se acepta y el paciente
    // igual no lo recibe: la tarea de correo falla y queda esperando.
    const entrega = faltantes(["RESEND_API_KEY", "EMAIL_FROM", "ADMIN_ALERT_EMAIL"]);

    // El worker que vacía la cola. Sin `CRON_SECRET` no se puede programar
    // desde fuera; las de QStash solo hacen falta si se elige ese camino.
    const worker = {
      faltantes: faltantes(["CRON_SECRET"]),
      qstashConfigurado: !faltantes(["QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY"]).length,
    };

    const listoParaEmitir = fiscal.completa && !entrega.length;

    return NextResponse.json({
      listoParaEmitir,
      fiscal,
      entrega: { faltantes: entrega },
      worker,
      // Dejarla puesta significa cobrar y facturar en ambientes distintos. Es
      // una salida legítima durante el corte y un problema si se olvida.
      avisos: fiscal.ambiente.mixtoPermitido
        ? ["FISCAL_AMBIENTE_MIXTO=1 está activa: los cobros y la facturación pueden estar en ambientes distintos. Quitala al terminar el corte."]
        : [],
    });
  } catch {
    // Ni el mensaje ni la traza: esta ruta lee configuración fiscal.
    console.error("[FE] CONFIG_DIAGNOSIS_FAILED");
    return NextResponse.json({ message: "No se pudo completar el diagnóstico." }, { status: 500 });
  }
}
