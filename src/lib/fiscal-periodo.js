// src/lib/fiscal-periodo.js
// Qué entra en una declaración y en qué mes, con los mismos criterios que usa
// Hacienda: el comprobante ACEPTADO y la fecha de emisión en hora de Costa Rica.

// Costa Rica es UTC-6 todo el año (no tiene horario de verano). La medianoche
// CR es las 06:00 UTC. Vercel corre en UTC: `new Date(año, mes, 1)` arma la
// medianoche UTC, que en CR son las 18:00 del día anterior, y una factura
// emitida el último día del mes después de las 18:00 caía en el mes siguiente.
const DESFASE_CR_HORAS = 6;

/** Instante en que empieza el día `dia` (1-31) del mes `mes` (1-12) en Costa Rica. */
function inicioDeDiaCr(anio, mes, dia) {
  return new Date(Date.UTC(anio, mes - 1, dia, DESFASE_CR_HORAS));
}

/** Límites [start, end) de un mes calendario de Costa Rica. */
export function limitesMesCr(anio, mes) {
  const a = Number(anio);
  const m = Number(mes);
  if (!Number.isInteger(a) || !Number.isInteger(m) || m < 1 || m > 12 || a < 2000 || a > 2100) {
    throw new Error("PERIODO_FISCAL_INVALIDO");
  }
  return { start: inicioDeDiaCr(a, m, 1), end: inicioDeDiaCr(a, m + 1, 1) };
}

/** Año y mes de Costa Rica en este instante. */
export function mesActualCr(ahora = new Date()) {
  const cr = new Date(ahora.getTime() - DESFASE_CR_HORAS * 3600 * 1000);
  return { year: cr.getUTCFullYear(), month: cr.getUTCMonth() + 1 };
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function parsearDia(valor) {
  const match = FECHA.exec(String(valor));
  if (!match) throw new Error("FECHA_INVALIDA");
  const [, a, m, d] = match.map(Number);
  const instante = inicioDeDiaCr(a, m, d);
  // Rechaza 2026-02-31 y similares, que Date.UTC desbordaría al mes siguiente.
  const control = new Date(instante.getTime() - DESFASE_CR_HORAS * 3600 * 1000);
  if (control.getUTCFullYear() !== a || control.getUTCMonth() !== m - 1 || control.getUTCDate() !== d) {
    throw new Error("FECHA_INVALIDA");
  }
  return { a, m, d, instante };
}

/**
 * Filtro de `invoiceDate` para un rango de días CR, con `dateTo` INCLUSIVO
 * (todo ese día cuenta). Recibe AAAA-MM-DD; lanza FECHA_INVALIDA si no.
 * Devuelve {} si no hay ninguno de los dos.
 */
export function filtroFechasCr(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const invoiceDate = {};
  if (dateFrom) invoiceDate.gte = parsearDia(dateFrom).instante;
  if (dateTo) {
    const { a, m, d } = parsearDia(dateTo);
    invoiceDate.lt = inicioDeDiaCr(a, m, d + 1);
  }
  return { invoiceDate };
}

/**
 * Venta o nota de crédito de venta que cuenta ante Hacienda: la que Hacienda
 * ACEPTÓ. Una rechazada no existe para Hacienda aunque el cobro sí haya
 * entrado (la 0204, ₡1.000, rechazada con -409, figuraba como PAID y el
 * reporte de IVA la sumaba).
 */
export const COMPROBANTE_DE_VENTA_DECLARADO = Object.freeze({
  feStatus: "ACCEPTED",
  status: { not: "CANCELLED" },
});
