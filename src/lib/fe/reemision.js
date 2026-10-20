// src/lib/fe/reemision.js
//
// Reemitir una factura que Hacienda rechazó.
//
// Una clave rechazada es definitiva: reenviarla devuelve siempre el mismo
// veredicto. La única salida es un comprobante nuevo, con consecutivo y clave
// nuevos. Y no corresponde nota de crédito, porque la rechazada nunca fue
// aceptada y por lo tanto nunca tuvo validez que rectificar.
//
// Lo que esta operación hace, en una sola transacción:
//
//   1. Anula internamente la rechazada (CANCELLED), con el motivo en `notes`.
//      Conserva su clave, su XML y la respuesta de Hacienda: son la evidencia
//      de lo que pasó. `feErrorMessage` no se toca, porque guarda el detalle
//      que mandó Hacienda.
//   2. Crea la reemisión en DRAFT, con el MISMO pago y la MISMA cita. El pago
//      no se duplica: los reportes de ingresos e impuestos excluyen las
//      canceladas, así que el ingreso pasa de una factura a la otra en vez de
//      contarse dos veces. La conciliación cruza por `appointmentId`, que se
//      conserva.
//   3. Cierra la tarea FE_SUBMISSION de la rechazada, si quedaba abierta.
//
// La reemisión queda SIN consecutivo. Lo toma al validarla
// (POST /api/invoices/:id/validate), que es donde se reclama el número dentro
// de la transacción que lo usa. Apartarlo acá lo dejaría colgando si después
// algo resulta estar mal.

import {
  SELECT_DATOS_FACTURACION,
  datosFacturacionDe,
} from "@/lib/fiscal-identity";

const ORIGEN_REEMISION = "REEMISION_DE:";

/** La marca que vincula una reemisión con la factura que reemplaza. */
export function origenDeReemision(invoiceId) {
  return `${ORIGEN_REEMISION}${invoiceId}`;
}

/** ¿Esta factura es la reemisión de otra? */
export function esReemision(invoice) {
  return String(invoice?.originDocument || "").startsWith(ORIGEN_REEMISION);
}

class ConflictoDeReemision extends Error {}

function rechazo(status, code, message) {
  return { ok: false, status, code, message };
}

/**
 * @param {object} db       Cliente Prisma (se abre una transacción adentro).
 * @param {string} invoiceId
 * @param {{ actorId?: string|null, ahora?: Date }} [opciones]
 */
export async function reemitirFacturaRechazada(db, invoiceId, { actorId = null, ahora = new Date() } = {}) {
  try {
    return await db.$transaction(async (tx) => {
      const original = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          lines: { orderBy: { sortOrder: "asc" } },
          _count: { select: { creditNotes: true } },
        },
      });
      if (!original) return rechazo(404, "NO_ENCONTRADA", "Factura no encontrada.");

      // Idempotencia: un doble clic, o reintentar después de un corte, devuelve
      // la reemisión que ya existe en vez de crear otra. Va antes que las
      // demás comprobaciones porque, después de reemitir, la original ya está
      // CANCELLED y de otro modo el segundo intento respondería con un error.
      const existente = await tx.invoice.findFirst({
        where: { invoiceType: original.invoiceType, originDocument: origenDeReemision(invoiceId) },
      });
      if (existente) return { ok: true, yaExistia: true, original, reemision: existente };

      if (original.invoiceType !== "CUSTOMER_INVOICE") {
        return rechazo(409, "TIPO_NO_REEMITIBLE", "Solo se reemiten las facturas que emitimos a clientes.");
      }
      if (original.feStatus !== "REJECTED" || !original.feClave) {
        return rechazo(
          409,
          "NO_RECHAZADA",
          original.feStatus === "ACCEPTED"
            ? "Hacienda aceptó esta factura: no se reemite. Si hay que corregirla, corresponde una nota de crédito."
            : "Solo se reemite una factura que Hacienda rechazó. Si está pendiente, todavía puede aceptarse.",
        );
      }
      if (!["OPEN", "PAID"].includes(original.status)) {
        return rechazo(409, "ESTADO_NO_REEMITIBLE", `La factura está en ${original.status}: no se puede reemitir.`);
      }
      if (!original.lines.length) {
        return rechazo(409, "SIN_LINEAS", "La factura no tiene líneas que reemitir.");
      }
      // Una nota de crédito sobre una rechazada no debería existir: rectifica
      // algo que nunca tuvo validez. Si la hay, el caso necesita a una persona.
      if (original._count.creditNotes > 0) {
        return rechazo(409, "TIENE_NOTA_CREDITO", "La factura tiene notas de crédito asociadas. Revísela a mano antes de reemitir.");
      }

      // El receptor se toma del perfil ACTUAL del contacto, no de la factura
      // rechazada. Una reemisión es una emisión nueva, y muchas veces el rechazo
      // es justamente por el receptor: la 0204 volvió con -409 por un tipo de
      // identificación que Hacienda no admite. Copiar el dato de la rechazada
      // reproduciría el mismo rechazo aunque alguien ya hubiera corregido el
      // perfil.
      //
      // Y si el dato actual tampoco sirve, se rechaza ACÁ, antes de anular nada:
      // así el orden es corregir el perfil y después reemitir, y no queda un
      // borrador con un receptor viejo que después nadie puede validar.
      const contacto = await tx.user.findUnique({
        where: { id: original.contactId },
        select: SELECT_DATOS_FACTURACION,
      });
      const receptor = datosFacturacionDe(contacto);
      if (!receptor.nombre || receptor.nombre.length < 3 || !receptor.tipoIdentificacion || !receptor.identificacion) {
        return rechazo(
          409,
          "RECEPTOR_SIN_IDENTIFICACION",
          "El cliente no tiene nombre completo e identificación fiscal en su perfil. Complételos antes de reemitir.",
        );
      }
      // Anular solo si sigue como se la leyó. Dos reemisiones simultáneas: la
      // segunda espera el candado de la fila, vuelve a evaluar este `where` con
      // la factura ya CANCELLED, no cambia nada y aborta.
      const anulada = await tx.invoice.updateMany({
        where: { id: invoiceId, status: { in: ["OPEN", "PAID"] }, feStatus: "REJECTED" },
        data: {
          status: "CANCELLED",
          notes:
            `${original.notes ? `${original.notes} | ` : ""}` +
            `ANULADA ${ahora.toISOString().slice(0, 10)}: rechazada por Hacienda (clave ${original.feClave}). ` +
            "Reemitida con consecutivo nuevo; sin nota de crédito porque nunca fue aceptada.",
        },
      });
      if (anulada.count !== 1) throw new ConflictoDeReemision();

      const reemision = await tx.invoice.create({
        data: {
          // Provisional y deliberadamente no numérico: `extractConsecutivo`
          // falla con él, así que no hay forma de emitirla sin validarla antes.
          invoiceNumber: `REEMISION-${original.invoiceNumber}`,
          invoiceType: original.invoiceType,
          documentType: original.documentType,
          status: "DRAFT",
          contactId: original.contactId,
          appointmentId: original.appointmentId,
          professionalId: original.professionalId,
          contactName: receptor.nombre,
          contactIdNumber: receptor.identificacion,
          contactIdType: receptor.tipoIdentificacion,
          economicActivity: original.economicActivity,
          paymentMethod: original.paymentMethod,
          cuentaDeposito: original.cuentaDeposito,
          currency: original.currency,
          // La fecha del comprobante la fija la validación: la clave de
          // Hacienda la codifica y tiene que ser la de la emisión real.
          invoiceDate: ahora,
          dueDate: ahora,
          // La del pago sí es la de siempre: el dinero entró cuando entró.
          paymentDate: original.paymentDate,
          subtotal: original.subtotal,
          taxAmount: original.taxAmount,
          discountAmount: original.discountAmount,
          total: original.total,
          amountPaid: original.amountPaid,
          balance: original.balance,
          // En una factura de cliente `originDocument` no llega al XML —solo
          // las notas de crédito arman InformacionReferencia con él—, así que
          // sirve de vínculo sin efecto fiscal.
          originDocument: origenDeReemision(invoiceId),
          notes:
            `Reemisión de ${original.invoiceNumber}, rechazada por Hacienda. ` +
            `Pago original: ${original.originDocument || "-"}.`,
          createdBy: actorId || original.createdBy,
          lines: {
            create: original.lines.map((l) => ({
              productId: l.productId,
              serviceId: l.serviceId,
              productName: l.productName,
              description: l.description,
              cabysCode: l.cabysCode,
              accountCode: l.accountCode,
              quantity: l.quantity,
              unitOfMeasure: l.unitOfMeasure,
              unitPrice: l.unitPrice,
              discountPercent: l.discountPercent,
              discountType: l.discountType,
              taxId: l.taxId,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              lineSubtotal: l.lineSubtotal,
              lineTotal: l.lineTotal,
              sortOrder: l.sortOrder,
            })),
          },
        },
      });

      // La tarea de la rechazada ya no tiene nada que hacer. El enum no tiene un
      // estado «anulado»; SUCCEEDED es el único terminal y `lastErrorCode` deja
      // constancia de que se cerró por reemisión y no por envío.
      await tx.deliveryJob.updateMany({
        where: { dedupeKey: `FE_SUBMISSION:${invoiceId}`, status: { not: "SUCCEEDED" } },
        data: {
          status: "SUCCEEDED",
          completedAt: ahora,
          lockedUntil: null,
          leaseToken: null,
          lastErrorCode: "FE_REEMITIDA",
        },
      });

      return { ok: true, yaExistia: false, original: { ...original, status: "CANCELLED" }, reemision };
    }, { timeout: 20_000, maxWait: 10_000 });
  } catch (error) {
    if (error instanceof ConflictoDeReemision) {
      return rechazo(409, "CONFLICTO", "La factura cambió mientras se reemitía. Recargue y vuelva a intentarlo.");
    }
    // Dos reemisiones que chocan en el número provisional único.
    if (error?.code === "P2002" || error?.code === "P2034") {
      return rechazo(409, "CONFLICTO", "Hubo otra escritura al mismo tiempo. Recargue y vuelva a intentarlo.");
    }
    throw error;
  }
}
