import { splitTaxIncluded } from "@/lib/invoice-math";
import { datosFacturacionDe } from "@/lib/fiscal-identity";
import { detalleLineaFactura } from "@/lib/detalle-consulta";

/** Se invoca dentro de la misma transacción que acredita el pago y la cita. */
export async function createPaymentInvoice(tx, transaction) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_PAYMENT_AMOUNT");
  const service = transaction.appointment?.service;
  const taxRate = Number(transaction.taxRate ?? service?.tax?.rate ?? 4);
  const { baseCents, taxCents } = splitTaxIncluded(Math.round(amount * 100), taxRate);
  const baseAmount = baseCents / 100;
  const taxAmount = taxCents / 100;
  const fiscalWarning = !service?.cabysCode || !service?.taxId;
  const now = new Date();
  const receptor = datosFacturacionDe(transaction.patient);
  const { productName, description } = detalleLineaFactura({
    fecha: transaction.appointment?.date,
    profesional: transaction.professional,
    paymentType: transaction.type,
  });

  // El consecutivo también revierte si falla la acreditación. No crear un
  // número provisional con Date.now(): dos cobros pueden compartir milisegundo.
  const sequence = await tx.invoiceSequence.upsert({
    where: { sequenceType: "CUSTOMER_INVOICE" },
    update: { currentNumber: { increment: 1 }, year: now.getFullYear() },
    create: { sequenceType: "CUSTOMER_INVOICE", currentNumber: 1, year: now.getFullYear(), prefix: "", padding: 4 },
  });
  const invoiceNumber = `${sequence.prefix || ""}${String(sequence.currentNumber).padStart(sequence.padding || 4, "0")}`;
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
      paymentMethod: "transfer",
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
      originDocument: `ONVO_TX:${transaction.id}`,
      notes: `ONVO Pay | Enlace: ${transaction.onvoPaymentLinkId || "-"} | Evento: ${transaction.onvoEventId || "-"}${fiscalWarning ? " | ALERTA: Servicio sin CABYS/IVA configurado" : ""}`,
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
