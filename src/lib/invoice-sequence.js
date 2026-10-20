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

import { PREFIJO_DE_SERIE } from "@/lib/fiscal-identity";

/**
 * Reclama el siguiente número de la serie y lo devuelve ya formateado.
 *
 * LA SERIE NO SE REINICIA NUNCA, y en particular no se reinicia al cambiar el
 * año. Hacienda exige que el consecutivo sea continuo y sin repeticiones por
 * sucursal, terminal y tipo de comprobante *a través* de los años: volver a
 * 0001 cada enero no ordenaría la numeración, la rompería, porque repetiría
 * números ya emitidos. Por eso acá solo se incrementa.
 *
 * `year` se escribe únicamente al crear la fila y de ahí no se vuelve a tocar:
 * registra el año en que arrancó la serie y NO condiciona ningún reinicio. Antes
 * se sobrescribía en cada asignación, con lo cual guardaba «el año de la última
 * factura» —un dato que nadie usaba— y aparentaba ser un control de reinicio que
 * no existe. El año que llega a llevar impreso un número de serie de proveedor
 * es el de la emisión, y lo pone quien arma el string.
 *
 * Se reclama SIEMPRE dentro de la transacción que crea la factura. Así, si la
 * creación falla, el número vuelve atrás con ella y no queda un hueco en la
 * serie. Y nunca se arma con Date.now(): dos cobros pueden caer en el mismo
 * milisegundo.
 *
 * @param {object} tx           Cliente Prisma DENTRO de una transacción.
 * @param {string} sequenceType Tipo de la serie (InvoiceType).
 * @param {Date}   now          Momento de emisión, solo para el año de creación.
 * @returns {Promise<string>}
 */
export async function siguienteNumeroDeFactura(tx, sequenceType = "CUSTOMER_INVOICE", now = new Date()) {
  const sequence = await tx.invoiceSequence.upsert({
    where: { sequenceType },
    update: { currentNumber: { increment: 1 } },
    // El prefijo solo se escribe al CREAR la serie, igual que `year`: cambiarlo
    // después renumeraría comprobantes ya emitidos. El de los tiquetes los
    // separa de las facturas en el número interno, que comparten tabla y
    // restricción de unicidad.
    create: {
      sequenceType,
      currentNumber: 1,
      year: now.getFullYear(),
      prefix: PREFIJO_DE_SERIE[sequenceType] ?? "",
      padding: 4,
    },
  });
  return `${sequence.prefix || ""}${String(sequence.currentNumber).padStart(sequence.padding || 4, "0")}`;
}
