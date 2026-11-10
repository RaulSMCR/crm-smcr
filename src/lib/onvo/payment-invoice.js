import { splitTaxIncluded } from "@/lib/invoice-math";
import { datosFacturacionDe, serieDeVentaSegunReceptor } from "@/lib/fiscal-identity";
import { detalleLineaFactura } from "@/lib/detalle-consulta";
import { siguienteNumeroDeFactura } from "@/lib/invoice-sequence";

/**
 * El saldo de una sesión cuya otra mitad entró como multa (caso del 9-nov-2026:
 * la paciente pagó el enlace de la multa por un fallo y asistió igual). Esa
 * factura no se rectifica por decisión de Raúl; esta la nombra, para que las
 * dos juntas digan qué se cobró. Con la reagenda tardía sin multa no debería
 * repetirse, pero si pasa, sale igual de clara.
 */
async function conReferenciaALaOtraMitad(tx, transaction, description) {
  if (transaction.type !== "BALANCE_50" && transaction.type !== "FULL_100") return description;
  if (typeof tx.paymentTransaction?.findFirst !== "function") return description;
  const multa = await tx.paymentTransaction.findFirst({
    where: { appointmentId: transaction.appointmentId, type: "PENALTY_50", status: "APPROVED" },
    select: { id: true },
  });
  if (!multa) return description;
  const factura = await tx.invoice.findFirst({
    where: { originDocument: `ONVO_TX:${multa.id}`, invoiceType: "CUSTOMER_INVOICE" },
    select: { invoiceNumber: true },
  });
  if (!factura?.invoiceNumber) return description;
  return `${description}. La otra mitad se pagó aparte y consta en la factura ${factura.invoiceNumber}.`;
}

/**
 * Se invoca dentro de la misma transacción que acredita el pago y la cita.
 *
 * `origen` describe de dónde salió la plata, y por defecto describe un cobro de
 * ONVO porque fue el único que hubo durante mucho tiempo. Un pago reportado a
 * mano llega con el suyo: otro medio de pago, la cuenta por la que entró y una
 * nota que lo dice. Lo que NO cambia entre los dos es el resto del comprobante
 * —consecutivo, receptor, CABYS, desglose del impuesto—, que es justo la razón
 * de que los dos pasen por acá en vez de armar cada uno su factura.
 *
 * @param {object} tx          Cliente Prisma dentro de la transacción.
 * @param {object} transaction Cobro ya acreditado, con cita, paciente y profesional.
 * @param {{paymentMethod?: string, cuentaDeposito?: string|null, originDocument?: string, notas?: string, invoiceDate?: Date, createdBy?: string}} [origen] invoiceDate solo después de validar el día de pago y atención.
 */
export async function createPaymentInvoice(tx, transaction, origen = {}) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_PAYMENT_AMOUNT");
  const service = transaction.appointment?.service;
  const taxRate = Number(transaction.taxRate ?? service?.tax?.rate ?? 4);
  const { baseCents, taxCents } = splitTaxIncluded(Math.round(amount * 100), taxRate);
  const baseAmount = baseCents / 100;
  const taxAmount = taxCents / 100;
  const fiscalWarning = !service?.cabysCode || !service?.taxId;
  const now = origen.invoiceDate ? new Date(origen.invoiceDate) : new Date();
  const receptor = datosFacturacionDe(transaction.patient);
  const detalle = detalleLineaFactura({
    fecha: transaction.appointment?.date,
    profesional: transaction.professional,
    paymentType: transaction.type,
  });
  const { productName } = detalle;
  const description = await conReferenciaALaOtraMitad(tx, transaction, detalle.description);

  // El consecutivo también revierte si falla la acreditación.
  // La serie la decide el receptor: el extranjero no domiciliado va por la del
  // tiquete electrónico. Ver serieDeVentaSegunReceptor().
  const invoiceNumber = await siguienteNumeroDeFactura(
    tx,
    serieDeVentaSegunReceptor(receptor.tipoIdentificacion),
    now,
  );
  const notasDeOrigen =
    origen.notas ||
    `ONVO Pay | Enlace: ${transaction.onvoPaymentLinkId || "-"} | Evento: ${transaction.onvoEventId || "-"}`;
  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      invoiceType: "CUSTOMER_INVOICE",
      status: "PAID",
      contactId: transaction.patientId,
      appointmentId: transaction.appointmentId,
      professionalId: transaction.professionalId,
      contactName: receptor.nombre || null,
      contactIdNumber: receptor.identificacion || null,
      contactIdType: receptor.tipoIdentificacion || null,
      paymentMethod: origen.paymentMethod || "transfer",
      cuentaDeposito: origen.cuentaDeposito || null,
      invoiceDate: now,
      dueDate: now,
      paymentDate: transaction.paidAt || now,
      subtotal: baseAmount,
      taxAmount,
      discountAmount: 0,
      total: amount,
      amountPaid: amount,
      balance: 0,
      currency: transaction.currency || "CRC",
      originDocument: origen.originDocument || `ONVO_TX:${transaction.id}`,
      notes: `${notasDeOrigen}${fiscalWarning ? " | ALERTA: Servicio sin CABYS/IVA configurado" : ""}`,
      ...(origen.createdBy ? { createdBy: origen.createdBy } : {}),
      lines: { create: {
        productName, description,
        serviceId: service?.id || transaction.appointment?.serviceId || null,
        cabysCode: service?.cabysCode || null,
        taxId: service?.taxId || null,
        quantity: 1,
        unitPrice: baseAmount,
        discountPercent: 0,
        taxRate,
        taxAmount,
        lineSubtotal: baseAmount,
        lineTotal: amount,
        sortOrder: 0,
      } },
    },
    select: { id: true },
  });
  return { invoiceId: invoice.id, fiscalWarning };
}
