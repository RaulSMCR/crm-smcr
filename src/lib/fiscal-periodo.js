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

const r2 = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;

/** Agrupa filas `invoiceLine.groupBy({ by: ["taxRate"] })` por tarifa y resta las notas de crédito por su valor absoluto. */
function netearPorTarifa(filas = [], notas = []) {
  const mapa = new Map();
  const fila = (tarifa) => {
    if (!mapa.has(tarifa)) mapa.set(tarifa, { tarifa, base: 0, iva: 0 });
    return mapa.get(tarifa);
  };
  for (const f of filas) {
    const t = fila(Number(f.taxRate));
    t.base += Number(f._sum?.lineSubtotal || 0);
    t.iva += Number(f._sum?.taxAmount || 0);
  }
  // Las notas del CRM se guardan en negativo; las de proveedor pueden venir en positivo.
  for (const f of notas) {
    const t = fila(Number(f.taxRate));
    t.base -= Math.abs(Number(f._sum?.lineSubtotal || 0));
    t.iva -= Math.abs(Number(f._sum?.taxAmount || 0));
  }
  return [...mapa.values()]
    .map((t) => ({ tarifa: t.tarifa, base: r2(t.base), iva: r2(t.iva) }))
    .filter((t) => t.base !== 0 || t.iva !== 0)
    .sort((a, b) => a.tarifa - b.tarifa);
}

/**
 * IVA de un mes con el criterio de la D-104 que presentó el contador para
 * septiembre de 2026 (IVA0120260901003101885661D000): quien vende con tarifa
 * reducida solo acredita el IVA de sus compras HASTA esa tarifa. Una compra al
 * 13 % de ₡30.000 (IVA ₡3.900) dio ₡1.200 de crédito (30.000 × 4 %) y ₡2.700
 * de «gasto para utilidades». Restar los ₡3.900 enteros declaraba de menos.
 *
 * La tarifa aplicada sale de las ventas del mes. Si hay más de una tarifa (o
 * ninguna venta) corresponde la prorrata, que no está implementada: se usa la
 * MENOR tarifa —nunca se acredita de más— y se marca `requiereRevision`.
 */
export function calcularIvaDelPeriodo({ ventas = [], notasVentas = [], compras = [], notasCompras = [] } = {}) {
  const filasVenta = netearPorTarifa(ventas, notasVentas);
  const filasCompra = netearPorTarifa(compras, notasCompras);

  const tarifasVenta = [...new Set(filasVenta.filter((f) => f.base > 0).map((f) => f.tarifa))];
  const tarifaAplicada = tarifasVenta.length ? Math.min(...tarifasVenta) : 0;
  const hayIvaSoportado = filasCompra.some((f) => f.iva !== 0);
  const requiereRevision = hayIvaSoportado && tarifasVenta.length !== 1;

  const comprasConCredito = filasCompra.map((f) => {
    const tope = r2(f.base * (Math.min(f.tarifa, tarifaAplicada) / 100));
    const credito = f.iva > 0 ? Math.min(f.iva, tope) : f.iva;
    return { ...f, credito: r2(credito), gasto: r2(f.iva - credito) };
  });

  const ivaDebito = r2(filasVenta.reduce((s, f) => s + f.iva, 0));
  const ivaSoportado = r2(filasCompra.reduce((s, f) => s + f.iva, 0));
  const creditoFiscal = r2(comprasConCredito.reduce((s, f) => s + f.credito, 0));
  return {
    ventas: filasVenta,
    compras: comprasConCredito,
    tarifaAplicada,
    requiereRevision,
    ivaDebito,
    ivaSoportado,
    creditoFiscal,
    gastoParaUtilidades: r2(ivaSoportado - creditoFiscal),
    impuestoDeterminado: r2(ivaDebito - creditoFiscal),
  };
}
