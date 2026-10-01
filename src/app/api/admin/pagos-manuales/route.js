// src/app/api/admin/pagos-manuales/route.js
//
// POST /api/admin/pagos-manuales
// Auth: ADMIN
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

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { pagoManualSchema, validationMessage } from "@/lib/financial-schemas";
import { registrarPagoManual } from "@/lib/pagos-manuales";
import { opcionesDeCuenta } from "@/lib/cuentas-de-cobro";
import { submitInvoiceToFe } from "@/lib/fe/submit";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json({ cuentas: opcionesDeCuenta() });
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const parsed = pagoManualSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: validationMessage(parsed.error) }, { status: 400 });
    }

    const registradoPor = String(auth.session.sub || auth.session.userId || "") || null;
    let resultado;
    try {
      resultado = await registrarPagoManual(prisma, { ...parsed.data, registradoPor });
    } catch (error) {
      // Dos escrituras simultáneas sobre la misma cita o el mismo consecutivo:
      // la transacción aborta sin dejar nada a medias y se puede reintentar tal
      // cual. No es un error del dato que mandó el administrador.
      if (["P2034", "P2002"].includes(error?.code)) {
        return NextResponse.json(
          { message: "Hubo otra escritura al mismo tiempo. Vuelva a enviarlo." },
          { status: 409 }
        );
      }
      throw error;
    }

    if (!resultado.ok) {
      return NextResponse.json({ message: resultado.message, code: resultado.code }, { status: resultado.status });
    }

    const factura = await prisma.invoice.findUnique({
      where: { id: resultado.invoiceId },
      select: { invoiceNumber: true, total: true },
    });

    // El envío a Hacienda se espera: es el resultado que el administrador vino a
    // buscar, y si Hacienda rechaza el comprobante tiene que enterarse ahora y no
    // por un correo que no llegó. La tarea encolada queda igual como red: si esta
    // llamada falla o el proceso muere, el worker la reintenta.
    let fe = { feStatus: "PENDING", feNumber: null, feErrorMessage: null };
    try {
      fe = await submitInvoiceToFe(resultado.invoiceId);
    } catch {
      // Sin detalle a propósito: el mensaje de un fallo al armar el comprobante
      // puede traer el nombre del receptor adentro, y eso no va a los logs.
      console.error("[pagos-manuales] FE_SUBMISSION_FAILED", { invoiceId: resultado.invoiceId });
    }

    // Los correos —confirmación del pago y comprobante con el XML adjunto— los
    // manda el mismo worker que los de ONVO, con sus reintentos y su control de
    // duplicados.
    after(() =>
      processPaymentDeliveries({ invoiceId: resultado.invoiceId }).catch(() =>
        console.error("[pagos-manuales] DELIVERY_DISPATCH_FAILED", { invoiceId: resultado.invoiceId })
      )
    );

    return NextResponse.json(
      {
        modo: resultado.modo,
        invoiceId: resultado.invoiceId,
        invoiceNumber: factura?.invoiceNumber || null,
        total: factura ? Number(factura.total) : null,
        transactionId: resultado.transactionId || null,
        appointmentId: resultado.appointmentId || null,
        paymentStatus: resultado.paymentStatus || null,
        feStatus: fe.feStatus,
        feNumber: fe.feNumber || null,
        feErrorMessage: fe.feErrorMessage || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[pagos-manuales] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
