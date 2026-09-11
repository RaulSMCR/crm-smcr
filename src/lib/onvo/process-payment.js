import { matchTransaction } from "@/lib/onvo/match-payment";
import { normalizeOnvoEvent } from "@/lib/onvo/event";
import { createPaymentInvoice } from "@/lib/onvo/payment-invoice";
import { estimateOnvoFee } from "@/lib/commission-plan";
import { enqueueDelivery } from "@/lib/delivery-jobs";

const PAYMENT_CONTEXT = {
  appointment: { select: {
    id: true, status: true, paymentStatus: true, isFirstWithProfessional: true,
    date: true, locationName: true, locationAddress: true, locationNotes: true,
    modality: true, pricePaid: true,
    service: { select: { id: true, title: true, cabysCode: true, taxId: true, tax: { select: { id: true, rate: true } } } },
  } },
  patient: { select: {
    name: true, email: true, identification: true,
    billingName: true, billingIdType: true, billingIdNumber: true, billingEmail: true,
    hasInsurance: true, useInsuranceForPayment: true, insuranceName: true, insuranceTemplateUrl: true,
  } },
  professional: { select: { academicDegree: true, user: { select: { name: true, email: true } } } },
};

/** Reintentar solo transacciones abortadas, sin emails ni llamadas externas. */
async function serializable(prisma, operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (attempt >= 3 || !["P2034", "P2002"].includes(error?.code)) throw error;
    }
  }
}

function matching(transaction, event) {
  return matchTransaction([{ ...transaction, patientEmail: transaction.patient?.email }], event);
}

async function applyPayment(tx, transaction, event, payload, usdCrcRate, manual = false) {
  const status = event.resultado === "aprobado" ? "APPROVED" : event.resultado === "rechazado" ? "REJECTED" : "LINK_SENT";
  let fees = {};
  if (status === "APPROVED") {
    const fee = estimateOnvoFee(Math.round(Number(transaction.amount) * 100), event.paymentMethod, { usdCrcRate });
    fees = { processingFee: fee.totalCents / 100, processingFeeUsd: fee.fixedUsd, usdCrcRate: fee.usdCrcRate };
  }
  const updated = await tx.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status, onvoEventId: event.eventId,
      statusMessage: manual ? "Conciliado manualmente por ADMIN" : `ONVO: ${event.tipo || event.resultado}`,
      paidAt: status === "APPROVED" ? event.paidAt : null,
      webhookPayload: payload,
      ...(status === "APPROVED" ? { taxRate: Number(transaction.appointment?.service?.tax?.rate ?? 4), ...fees } : {}),
    },
  });
  const processed = { ...transaction, ...updated };
  if (status !== "APPROVED") return { kind: "processed", transaction: processed };

  // Un adelanto tardío no puede degradar un saldo ya pagado. Tampoco borra
  // un estado de reembolso de la cita; ese caso necesita revisión operativa.
  const previous = transaction.appointment.paymentStatus;
  const nextPaymentStatus = ["PAID", "REFUNDED"].includes(previous)
    ? previous : transaction.type === "DEPOSIT_50" ? "PARTIALLY_PAID" : "PAID";
  await tx.appointment.update({ where: { id: transaction.appointmentId }, data: { paymentStatus: nextPaymentStatus } });
  processed.appointment = { ...transaction.appointment, paymentStatus: nextPaymentStatus };
  const invoice = await createPaymentInvoice(tx, processed);
  await enqueueDelivery(tx, { kind: "PAYMENT_CONFIRMATION", invoiceId: invoice.invoiceId, paymentTransactionId: transaction.id });
  await enqueueDelivery(tx, { kind: "FE_SUBMISSION", invoiceId: invoice.invoiceId });
  return { kind: "processed", transaction: processed, nextPaymentStatus, ...invoice };
}

export function processOnvoPayment(prisma, event, payload, { usdCrcRate } = {}) {
  return serializable(prisma, async (tx) => {
    const [processed, unmatched] = await Promise.all([
      tx.paymentTransaction.findFirst({ where: { onvoEventId: event.eventId } }),
      tx.unmatchedPayment.findUnique({ where: { onvoEventId: event.eventId } }),
    ]);
    if (processed || unmatched) return { kind: "duplicate" };

    const candidates = event.onvoLinkId ? await tx.paymentTransaction.findMany({
      where: {
        onvoPaymentLinkId: event.onvoLinkId,
        status: { in: event.resultado === "aprobado" ? ["PENDING", "LINK_SENT", "REJECTED"] : ["PENDING", "LINK_SENT"] },
      },
      orderBy: { createdAt: "desc" },
      include: PAYMENT_CONTEXT,
    }) : [];
    const result = matchTransaction(candidates.map((row) => ({ ...row, patientEmail: row.patient?.email })), event);
    if (result.unmatchedReason) {
      const reason = result.unmatchedDetail || result.unmatchedReason;
      await tx.unmatchedPayment.create({ data: {
        onvoEventId: event.eventId,
        onvoLinkId: event.onvoLinkId || null,
        amount: event.amount != null ? Number(event.amount) : null,
        currency: event.currency || null,
        customerEmail: event.customerEmail || null,
        reason, payload,
      } });
      return { kind: "unmatched", reason, reasonCode: result.unmatchedReason };
    }
    return applyPayment(tx, result.match, event, payload, usdCrcRate);
  });
}

/** La selección del administrador no permite reutilizar un cobro o resucitar un reembolso. */
export function reconcileOnvoPayment(prisma, { unmatchedId, transactionId, usdCrcRate }) {
  return serializable(prisma, async (tx) => {
    const unmatched = await tx.unmatchedPayment.findUnique({ where: { id: unmatchedId } });
    if (!unmatched) return { kind: "not_found" };
    if (unmatched.resolvedAt) {
      return unmatched.resolvedTxId === transactionId ? { kind: "duplicate" } : { kind: "conflict" };
    }
    const transaction = await tx.paymentTransaction.findUnique({ where: { id: transactionId }, include: PAYMENT_CONTEXT });
    if (!transaction) return { kind: "not_found" };
    if (!["PENDING", "LINK_SENT", "REJECTED"].includes(transaction.status)) return { kind: "conflict" };
    const event = normalizeOnvoEvent(unmatched.payload);
    if (event.resultado !== "aprobado" || event.eventId !== unmatched.onvoEventId || event.onvoLinkId !== transaction.onvoPaymentLinkId || matching(transaction, event).unmatchedReason) {
      return { kind: "conflict" };
    }
    const alreadyApplied = await tx.paymentTransaction.findFirst({ where: { onvoEventId: event.eventId } });
    if (alreadyApplied) return { kind: "conflict" };
    const result = await applyPayment(tx, transaction, event, unmatched.payload, usdCrcRate, true);
    await tx.unmatchedPayment.update({
      where: { id: unmatchedId }, data: { resolvedAt: new Date(), resolvedTxId: transactionId },
    });
    return result;
  });
}
