// src/app/api/pro/pagos-manuales/route.js
//
// POST /api/pro/pagos-manuales — registrar desde la app un pago que no pasó por
// ONVO (SINPE, efectivo, transferencia) y emitir su factura.
//
// Solo Raúl: su cuenta de profesional o la de administración responsable de la
// emisión, las mismas dos que habilita el piloto PALIG (requirePaligOperator).
// Ningún otro profesional registra cobros fuera de ONVO: una factura emitida a
// partir de un pago reportado a mano es una declaración de parte, y responde por
// ella quien emite. Lo demás —validar, facturar, mandar a Hacienda, avisar— es
// el mismo recorrido que Pagos manuales (src/lib/pagos-manuales-respuesta.js).
//
// GET devuelve el catálogo de cuentas, para que la app no lo duplique.

import { NextResponse } from "next/server";
import { requirePaligOperator } from "@/lib/palig-auth";
import { opcionesDeCuenta } from "@/lib/cuentas-de-cobro";
import { procesarPagoManual } from "@/lib/pagos-manuales-respuesta";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePaligOperator();
  if (auth.error) return auth.error;
  return NextResponse.json({ cuentas: opcionesDeCuenta() });
}

export async function POST(request) {
  try {
    const auth = await requirePaligOperator();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    // Desde la app siempre se cobra una cita; los cobros sueltos siguen en
    // Contabilidad.
    const { status, body: respuesta } = await procesarPagoManual({
      body,
      registradoPor: auth.userId,
      soloDeCita: true,
    });
    return NextResponse.json(respuesta, { status });
  } catch (error) {
    console.error("[pro/pagos-manuales] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
