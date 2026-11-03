// src/app/api/admin/pagos-manuales/route.js
//
// POST /api/admin/pagos-manuales
// Auth: ADMIN responsable de la emisión fiscal (ver requireEmisorResponsable)
//
// Cierra el loop de pago y facturación cuando el cobro no pasó por ONVO. El
// administrador reporta un pago que YA se recibió —cliente, monto y cuenta por la
// que entró— y el sistema hace el resto del recorrido: registra el cobro, emite
// la factura con su consecutivo, la manda a Hacienda y le envía el comprobante al
// cliente.
//
// No cobra nada. No habla con ningún procesador. Registra un hecho pasado.
//
// GET devuelve el catálogo de cuentas, para que el panel no lo duplique.

import { NextResponse } from "next/server";
import { requireEmisorResponsable } from "@/lib/api-guards";
import { opcionesDeCuenta } from "@/lib/cuentas-de-cobro";
import { procesarPagoManual } from "@/lib/pagos-manuales-respuesta";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEmisorResponsable();
  if (auth.error) return auth.error;
  return NextResponse.json({ cuentas: opcionesDeCuenta() });
}

export async function POST(request) {
  try {
    const auth = await requireEmisorResponsable();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const registradoPor = String(auth.session.sub || auth.session.userId || "") || null;
    // El recorrido es el mismo que el de la app de profesionales: ver
    // src/lib/pagos-manuales-respuesta.js.
    const { status, body: respuesta } = await procesarPagoManual({ body, registradoPor });
    return NextResponse.json(respuesta, { status });
  } catch (error) {
    console.error("[pagos-manuales] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
