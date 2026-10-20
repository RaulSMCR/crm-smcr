// src/app/api/invoices/[id]/reissue/route.js
//
// POST /api/invoices/:id/reissue
// Auth: ADMIN responsable de la emisión fiscal (ver requireEmisorResponsable)
//
// Reemite una factura que Hacienda rechazó: la anula internamente y deja la
// reemisión en borrador, con el mismo pago y la misma cita. La lógica y sus
// invariantes están en src/lib/fe/reemision.js.
//
// Por qué es una ruta aparte y no una excepción en /cancel: cancelar exige
// DRAFT u OPEN sin pagos, y esa regla es correcta —anular una factura cobrada
// sin más deja el dinero sin comprobante—. La reemisión es otra operación:
// anula Y traslada el pago a la factura nueva en la misma transacción. Meterla
// en /cancel obligaría a debilitar una regla que sigue haciendo falta.
//
// No contacta a Hacienda ni asigna consecutivo.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmisorResponsable } from "@/lib/api-guards";
import { reemitirFacturaRechazada } from "@/lib/fe/reemision";

export const dynamic = "force-dynamic";

/** La forma de fila que espera el listado del panel. */
function comoFila(invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    contactName: invoice.contactName,
    total: Number(invoice.total),
    amountPaid: Number(invoice.amountPaid),
    balance: Number(invoice.balance),
    feStatus: invoice.feStatus,
    feNumber: invoice.feNumber,
    feClave: invoice.feClave,
    feErrorMessage: invoice.feErrorMessage,
    appointmentId: invoice.appointmentId,
    originDocument: invoice.originDocument,
  };
}

export async function POST(_request, { params }) {
  try {
    const auth = await requireEmisorResponsable();
    if (auth.error) return auth.error;

    const id = String((await params)?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const actorId = String(auth.session.sub || auth.session.userId || "") || null;
    const resultado = await reemitirFacturaRechazada(prisma, id, { actorId });

    if (!resultado.ok) {
      return NextResponse.json({ message: resultado.message, code: resultado.code }, { status: resultado.status });
    }

    return NextResponse.json(
      {
        yaExistia: resultado.yaExistia,
        original: { id: resultado.original.id, status: resultado.original.status },
        reemision: comoFila(resultado.reemision),
      },
      { status: resultado.yaExistia ? 200 : 201 },
    );
  } catch {
    console.error("[invoices/:id/reissue] REISSUE_FAILED");
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
