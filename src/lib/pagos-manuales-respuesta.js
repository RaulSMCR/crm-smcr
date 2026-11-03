// src/lib/pagos-manuales-respuesta.js
//
// El recorrido completo de un pago manual —validar, registrar, mandar a
// Hacienda y encolar los correos— y la respuesta que recibe quien lo pidió.
//
// Lo comparten la ruta de administración (/api/admin/pagos-manuales) y la de la
// app de profesionales (/api/pro/pagos-manuales). Cada ruta decide QUIÉN puede
// llamarlo; esto decide QUÉ pasa, y tiene que pasar exactamente igual en las dos:
// es una factura ante Hacienda.

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { pagoManualSchema, validationMessage } from "@/lib/financial-schemas";
import { registrarPagoManual } from "@/lib/pagos-manuales";
import { submitInvoiceToFe } from "@/lib/fe/submit";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

/**
 * @param {object} opciones
 * @param {object} opciones.body           lo que llegó en el POST
 * @param {string|null} opciones.registradoPor  id del usuario que lo reporta
 * @param {boolean} [opciones.soloDeCita]  la app no registra cobros sueltos
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function procesarPagoManual({ body, registradoPor, soloDeCita = false }) {
  const parsed = pagoManualSchema.safeParse(body || {});
  if (!parsed.success) return { status: 400, body: { message: validationMessage(parsed.error) } };
  if (soloDeCita && !parsed.data.appointmentId) {
    return { status: 400, body: { message: "Elija la cita que se cobró." } };
  }

  let resultado;
  try {
    resultado = await registrarPagoManual(prisma, { ...parsed.data, registradoPor });
  } catch (error) {
    // Dos escrituras simultáneas sobre la misma cita o el mismo consecutivo:
    // la transacción aborta sin dejar nada a medias y se puede reintentar tal
    // cual. No es un error del dato que se mandó.
    if (["P2034", "P2002"].includes(error?.code)) {
      return { status: 409, body: { message: "Hubo otra escritura al mismo tiempo. Vuelva a enviarlo." } };
    }
    throw error;
  }

  if (!resultado.ok) {
    return { status: resultado.status, body: { message: resultado.message, code: resultado.code } };
  }

  const factura = await prisma.invoice.findUnique({
    where: { id: resultado.invoiceId },
    select: { invoiceNumber: true, total: true },
  });

  // El envío a Hacienda se espera: es el resultado que se vino a buscar, y si
  // Hacienda rechaza el comprobante hay que enterarse ahora y no por un correo
  // que no llegó. La tarea encolada queda igual como red: si esta llamada falla
  // o el proceso muere, el worker la reintenta.
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

  return {
    status: 201,
    body: {
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
  };
}
