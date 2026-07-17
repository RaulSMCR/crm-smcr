import { prisma } from "@/lib/prisma";
import { sendServerConversionEvent } from "@/lib/analytics/sendServerConversionEvent";

/**
 * client_id determinístico a partir de una semilla (el id de la transacción).
 * Se usa cuando la cita no guardó gaClientId (ej. citas creadas por el
 * profesional, o anteriores a esta función). Determinístico = estable entre
 * reintentos, nunca genera dos ids distintos para la misma transacción.
 * Formato de dos enteros separados por punto, como GA4.
 */
export function deterministicClientId(seed) {
  const str = String(seed || "");
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0; // FNV-1a
    h2 = ((h2 << 5) + h2 + c) >>> 0; // djb2
  }
  return `${h1}.${h2}`;
}

/**
 * Envía la conversión GA4 del adelanto (evento `deposit_paid`) de forma idempotente.
 *
 * Idempotencia por CLAIM ATÓMICO: un solo `updateMany` pone conversionSent de
 * false→true; solo un caller gana la carrera (webhook vs. conciliación). Si el
 * envío a GA4 falla, se revierte para poder reintentar sin perder la conversión.
 *
 * Se llama únicamente para transacciones DEPOSIT_50 ya APPROVED.
 *
 * @param {string} transactionId
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function reportDepositConversion(transactionId) {
  const id = String(transactionId || "");
  if (!id) return { sent: false, reason: "missing_id" };

  // 1) Reclamo atómico: solo pasa quien encuentra conversionSent=false.
  const claim = await prisma.paymentTransaction.updateMany({
    where: { id, type: "DEPOSIT_50", status: "APPROVED", conversionSent: false },
    data: { conversionSent: true, conversionSentAt: new Date() },
  });

  if (claim.count !== 1) {
    return { sent: false, reason: "already_sent_or_not_applicable" };
  }

  // 2) Cargar datos para el evento (con los identificadores de la cita).
  const tx = await prisma.paymentTransaction.findUnique({
    where: { id },
    include: { appointment: { select: { gaClientId: true, gaGclid: true } } },
  });

  const clientId = tx?.appointment?.gaClientId || deterministicClientId(id);
  const gclid = tx?.appointment?.gaGclid || undefined;

  const ok = await sendServerConversionEvent({
    clientId,
    gclid,
    transactionId: id,
    value: Number(tx?.amount ?? 0),
    currency: tx?.currency || "CRC",
  });

  // 3) Si falló el envío, liberar el claim para reintentar más tarde.
  if (!ok) {
    await prisma.paymentTransaction
      .update({ where: { id }, data: { conversionSent: false, conversionSentAt: null } })
      .catch((e) => console.error("[ga4-mp] No se pudo revertir conversionSent:", e));
    return { sent: false, reason: "send_failed" };
  }

  return { sent: true };
}
