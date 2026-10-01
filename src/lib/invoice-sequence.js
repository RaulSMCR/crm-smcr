// src/lib/invoice-sequence.js
//
// El consecutivo de las facturas que emitimos.
//
// Vive aparte porque ya son dos los caminos que emiten una factura de cliente
// —el cobro de ONVO y el pago que el administrador reporta a mano— y el número
// no puede calcularse distinto en cada uno: Hacienda exige que la serie sea
// continua y sin repeticiones, y un número repetido se descubre cuando el
// segundo comprobante se rechaza con el pago ya cobrado.
//
// Se reclama SIEMPRE dentro de la transacción que crea la factura. Así, si la
// creación falla, el número vuelve atrás con ella y no queda un hueco en la
// serie. Y nunca se arma con Date.now(): dos cobros pueden caer en el mismo
// milisegundo.

/**
 * Reclama el siguiente número de la serie y lo devuelve ya formateado.
 *
 * @param {object} tx           Cliente Prisma DENTRO de una transacción.
 * @param {string} sequenceType Tipo de la serie (InvoiceType).
 * @param {Date}   now          Momento de emisión, para el año de la serie.
 * @returns {Promise<string>}
 */
export async function siguienteNumeroDeFactura(tx, sequenceType = "CUSTOMER_INVOICE", now = new Date()) {
  const sequence = await tx.invoiceSequence.upsert({
    where: { sequenceType },
    update: { currentNumber: { increment: 1 }, year: now.getFullYear() },
    create: { sequenceType, currentNumber: 1, year: now.getFullYear(), prefix: "", padding: 4 },
  });
  return `${sequence.prefix || ""}${String(sequence.currentNumber).padStart(sequence.padding || 4, "0")}`;
}
