// src/lib/invoice-draft-lines.js
//
// Las líneas de una factura armada a mano desde el panel, y lo que le falta a
// un borrador para poder emitirse.
//
// El CABYS y el impuesto de una línea salen del SERVICIO, no de lo que mande el
// navegador: son los mismos que usan el webhook de ONVO y los pagos manuales, y
// así una consulta facturada a mano no puede salir con otra tarifa.
//
// El descuento es posible pero no mudo: lleva un motivo, que viaja al XML como
// `NaturalezaDescuento` (la 4.4 admite de 3 a 80 caracteres). Ese campo se
// guarda en `InvoiceLine.discountType`, que es texto libre y ya pasa intacto por
// las notas de crédito y las reemisiones.

import { computeInvoiceLine, round2 } from "@/lib/invoice-math";

export const MOTIVO_DESCUENTO_MIN = 3;
export const MOTIVO_DESCUENTO_MAX = 80;

function falla(status, message) {
  return { ok: false, status, message };
}

/** El motivo del descuento tal como va al comprobante, o null si no hay. */
export function motivoDeDescuento(line) {
  const motivo = String(line?.discountType || "").replace(/\s+/g, " ").trim();
  return motivo || null;
}

/**
 * Valida el descuento de una línea. Devuelve null si está bien, o el mensaje.
 *
 * Un descuento del 100 % deja la línea en cero y no hay impuesto que declarar:
 * una consulta que no se cobró no se factura así.
 */
export function problemaDeDescuento(line, etiqueta = "la línea") {
  const pct = round2(Number(line?.discountPercent || 0));
  if (!(pct > 0)) return null;
  if (pct >= 100) return `El descuento de ${etiqueta} tiene que ser menor al 100 %.`;
  const motivo = motivoDeDescuento(line);
  if (!motivo || motivo.length < MOTIVO_DESCUENTO_MIN) {
    return `Explique el motivo del descuento de ${etiqueta}: Hacienda lo recibe en el comprobante.`;
  }
  if (motivo.length > MOTIVO_DESCUENTO_MAX) {
    return `El motivo del descuento de ${etiqueta} no puede pasar de ${MOTIVO_DESCUENTO_MAX} caracteres.`;
  }
  return null;
}

/**
 * Convierte las líneas recibidas en filas de `InvoiceLine`.
 *
 * Si la línea trae `serviceId`, el CABYS, el impuesto y la tasa se toman del
 * servicio y se ignora lo que haya llegado en el cuerpo.
 */
export async function resolverLineas(db, lines = []) {
  const ids = [...new Set(lines.map((l) => (l?.serviceId ? String(l.serviceId) : "")).filter(Boolean))];
  const servicios = ids.length
    ? await db.service.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, cabysCode: true, taxId: true, tax: { select: { rate: true } } },
      })
    : [];
  const porId = new Map(servicios.map((s) => [s.id, s]));

  const filas = [];
  for (const [index, line] of lines.entries()) {
    const etiqueta = `la línea ${index + 1}`;
    const serviceId = line?.serviceId ? String(line.serviceId) : null;
    const servicio = serviceId ? porId.get(serviceId) : null;
    if (serviceId && !servicio) return falla(404, `El servicio de ${etiqueta} no existe.`);

    const problema = problemaDeDescuento(line, etiqueta);
    if (problema) return falla(400, problema);

    const taxRate = servicio ? Number(servicio.tax?.rate ?? 0) : line?.taxRate;
    const calc = computeInvoiceLine({ ...line, taxRate });
    filas.push({
      productId: line.productId ? String(line.productId) : null,
      serviceId,
      productName: String(line.productName || "").trim() || "Ítem",
      description: line.description ? String(line.description) : null,
      cabysCode: servicio ? servicio.cabysCode || null : line.cabysCode ? String(line.cabysCode) : null,
      accountCode: line.accountCode ? String(line.accountCode) : null,
      quantity: calc.quantity,
      unitOfMeasure: line.unitOfMeasure ? String(line.unitOfMeasure) : "Unidad(es)",
      unitPrice: calc.unitPrice,
      discountPercent: calc.discountPercent,
      discountType: calc.discountPercent > 0 ? motivoDeDescuento(line) : null,
      taxId: servicio ? servicio.taxId || null : line.taxId ? String(line.taxId) : null,
      taxRate: calc.taxRate,
      taxAmount: calc.taxAmount,
      lineSubtotal: calc.lineSubtotal,
      lineTotal: calc.lineTotal,
      sortOrder: Number.isInteger(line.sortOrder) ? line.sortOrder : index,
    });
  }
  return { ok: true, lines: filas };
}

/**
 * Lo que le falta a un borrador de venta para que Hacienda lo acepte.
 *
 * Se consulta ANTES de asignar el consecutivo: si el problema apareciera al
 * armar el XML, el número ya estaría tomado por un documento que no va a salir,
 * y la serie queda con un hueco. Mismos criterios que `generateFeXml`.
 *
 * @param {object} invoice Con `lines` (y, si se tiene, `lines[].service.cabysCode`).
 * @returns {string|null} El primer problema encontrado, o null.
 */
export function faltaParaEmitir(invoice) {
  const nombre = String(invoice?.contactName || "").trim();
  if (nombre.length < 3) {
    return "La factura no tiene el nombre del cliente. Complete sus datos de facturación antes de validarla.";
  }
  if (!String(invoice?.contactIdNumber || "").trim()) {
    return "El cliente no tiene identificación fiscal. Complete el tipo y el número en su perfil antes de validarla.";
  }
  for (const [index, line] of (invoice?.lines || []).entries()) {
    const etiqueta = `la línea ${index + 1}`;
    const cabys = line.cabysCode || line.service?.cabysCode || line.product?.cabysCode;
    if (!cabys) {
      return `Falta el código CABYS de ${etiqueta}. Elija un servicio que lo tenga configurado.`;
    }
    const problema = problemaDeDescuento(line, etiqueta);
    if (problema) return problema;
  }
  return null;
}
