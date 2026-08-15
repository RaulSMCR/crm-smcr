// src/lib/fe/xml.js
// Genera el XML de Factura Electrónica v4.4 para Hacienda CR.
//
// La estructura sigue campo por campo un comprobante REAL aceptado por Hacienda
// (ver tmp/referencia-178.xml y tests/unit/fe-xml.test.js). Cuando haya duda
// sobre orden de elementos, cantidad de decimales o nombres, ese archivo manda:
// es la única fuente que sabemos que pasa la validación.
//
// Diferencias que trajo la 4.4 respecto de la 4.3, por si aparece documentación
// vieja: `CodigoActividad` pasó a `CodigoActividadEmisor` y ahora va con punto
// (8690.9); apareció `ProveedorSistemas`; `CodigoTarifa` pasó a `CodigoTarifaIVA`;
// se agregaron `BaseImponible` e `ImpuestoAsumidoEmisorFabrica` por línea; y
// `MedioPago` dejó de ser un elemento suelto para vivir dentro de ResumenFactura
// con su propio monto.

import { create } from "xmlbuilder2";
import {
  FE_EMISOR,
  TIPO_DOC_MAP,
  MEDIO_PAGO_MAP,
  NS_MAP,
  ROOT_ELEMENT_MAP,
} from "./config.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Importes de venta: la 4.4 los lleva con 5 decimales. */
const fmt5 = (n) => round2(n).toFixed(5);
/** Impuestos y totales a pagar: 2 decimales. */
const fmt2 = (n) => round2(n).toFixed(2);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Formatea una fecha en la hora de Costa Rica con offset -06:00.
 *
 * NO se puede usar la hora local del servidor: en Vercel corre en UTC y en una
 * maquina de desarrollo puede estar en cualquier zona. Tomar los componentes
 * locales y pegarles "-06:00" produce un timestamp corrido tantas horas como
 * diferencia haya, y Hacienda lo rechaza con el error -53 ("La hora indicada en
 * la emision del archivo XML no coincide con la hora oficial").
 *
 * Costa Rica no aplica horario de verano, asi que el offset es siempre -06:00.
 */
function feCrDate(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const parte = (tipo) => partes.find((p) => p.type === tipo).value;

  return `${parte("year")}-${parte("month")}-${parte("day")}` +
    `T${parte("hour")}:${parte("minute")}:${parte("second")}-06:00`;
}

/**
 * Normaliza el código de actividad al formato NNNN.N que pide la 4.4.
 * Acepta el formato viejo sin punto (86909 → 8690.9) para no obligar a tocar
 * el entorno de instalaciones que vienen de la 4.3.
 */
export function formatCodigoActividad(codigo) {
  const limpio = String(codigo || "").trim();
  if (/^\d+\.\d$/.test(limpio)) return limpio;

  const digitos = limpio.replace(/\D/g, "");
  if (digitos.length < 2) return limpio;
  return `${digitos.slice(0, -1)}.${digitos.slice(-1)}`;
}

/**
 * Infiere el tipo de identificación a partir del número.
 * 01=Cédula Física (9 dig), 02=Cédula Jurídica (10 dig, empieza con 3),
 * 03=DIMEX (11-12 dig), 04=NITE
 */
function inferIdType(idNumber) {
  if (!idNumber) return null;
  const clean = String(idNumber).replace(/\D/g, "");
  if (clean.length === 9)                             return "01";
  if (clean.length === 10 && clean.startsWith("3"))   return "02";
  if (clean.length === 11 || clean.length === 12)      return "03";
  return "04";
}

/**
 * Genera la Clave de 50 dígitos.
 * El tipo de documento no se recibe aparte: ya viene embebido en `feNumber`.
 */
export function buildFeClave(feNumber, invoiceDate, securityCode) {
  const d    = invoiceDate instanceof Date ? invoiceDate : new Date(invoiceDate);
  const pad  = (n, l) => String(n).padStart(l, "0");
  const date = `${pad(d.getDate(), 2)}${pad(d.getMonth() + 1, 2)}${String(d.getFullYear()).slice(2)}`;

  const pais     = "506";
  const cedula   = FE_EMISOR.identificacion.padStart(12, "0");
  const consec20 = feNumber.padStart(20, "0");
  const situacion = "1"; // 1=Normal, 2=Contingencia, 3=Rango sin internet
  const security = securityCode || String(Math.floor(Math.random() * 99999999)).padStart(8, "0");

  return `${pais}${date}${cedula}${consec20}${situacion}${security}`.padEnd(50, "0").slice(0, 50);
}

/** Genera el NumeroConsecutivo de 20 dígitos */
export function buildFeNumber(invoiceType, consecutivo) {
  const tipoDoc = TIPO_DOC_MAP[invoiceType] || "01";
  const consec  = String(Math.abs(consecutivo)).padStart(10, "0");
  return `${FE_EMISOR.sucursal}${FE_EMISOR.terminal}${tipoDoc}${consec}`;
}

/**
 * Extrae el consecutivo numérico de un invoiceNumber.
 *
 * Falla en vez de asumir 1 cuando el número no es utilizable. La versión previa
 * devolvía 1 en silencio ante cualquier cosa no numérica —incluido el
 * `AUTO-<timestamp>` provisorio de createAutoInvoice—, y Hacienda respondía
 * "la numeración consecutiva ya existe", un motivo que no apunta a la causa.
 * Es preferible que el envío falle con un mensaje claro a emitir un comprobante
 * con el consecutivo equivocado.
 */
export function extractConsecutivo(invoiceNumber) {
  const ultimo = String(invoiceNumber ?? "").split("/").pop().trim();

  if (!/^\d+$/.test(ultimo)) {
    throw new Error(
      `Número de factura no utilizable como consecutivo: "${invoiceNumber}". ` +
        "Debe ser numérico (admite ceros a la izquierda y prefijos separados por '/')."
    );
  }

  const consecutivo = parseInt(ultimo, 10);
  if (consecutivo < 1) {
    throw new Error(`El consecutivo debe ser mayor que cero, se recibió "${invoiceNumber}".`);
  }

  return consecutivo;
}

/** Devuelve el código de tarifa de IVA según el porcentaje */
export function ivaTarifaCodigo(rate) {
  const r = round2(rate);
  if (r === 0)   return "01"; // Exento
  if (r === 1)   return "02";
  if (r === 2)   return "03";
  if (r === 4)   return "04"; // Servicios de salud
  if (r === 8)   return "05";
  if (r === 13)  return "06";
  return "07"; // Variable
}

// ─── Generador principal ─────────────────────────────────────────────────────

/**
 * Genera el XML de la FacturaElectronica (o NotaCreditoElectronica).
 *
 * @param {object} invoice  - Registro de Invoice de Prisma (con líneas incluidas)
 * @param {object[]} lines  - invoice.lines con { product: {...} }
 * @returns {{ xml: string, feNumber: string, feClave: string }}
 */
export function generateFeXml(invoice, lines) {
  const tipoDoc    = TIPO_DOC_MAP[invoice.invoiceType] || "01";
  const consecutivo = extractConsecutivo(invoice.invoiceNumber);
  const feNumber   = buildFeNumber(invoice.invoiceType, consecutivo);
  const feClave    = buildFeClave(feNumber, invoice.invoiceDate);
  const ns         = NS_MAP[tipoDoc];
  const rootEl     = ROOT_ELEMENT_MAP[tipoDoc];

  const invoiceDate = invoice.invoiceDate instanceof Date
    ? invoice.invoiceDate
    : new Date(invoice.invoiceDate);

  // Condición de venta
  const dueDate     = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const isCredit    = dueDate && dueDate > invoiceDate;
  const condVenta   = isCredit ? "02" : "01";

  // Medio de pago
  const medioPago = MEDIO_PAGO_MAP[String(invoice.paymentMethod || "").toLowerCase()] || "04";

  // Moneda
  const currency = invoice.currency || "CRC";

  // ─── Inicio documento ────────────────────────────────────────────────────
  const root = create({ version: "1.0", encoding: "utf-8" })
    .ele(rootEl, {
      xmlns:      ns,
      "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    });

  root.ele("Clave").txt(feClave);
  root.ele("ProveedorSistemas").txt(FE_EMISOR.proveedorSistemas);
  root.ele("CodigoActividadEmisor").txt(
    formatCodigoActividad(invoice.economicActivity || FE_EMISOR.actividadEconomica)
  );
  root.ele("NumeroConsecutivo").txt(feNumber);
  root.ele("FechaEmision").txt(feCrDate(invoiceDate));

  // ─── Emisor ──────────────────────────────────────────────────────────────
  const emisorEl = root.ele("Emisor");
  emisorEl.ele("Nombre").txt(FE_EMISOR.nombre);
  const idEmEl = emisorEl.ele("Identificacion");
  idEmEl.ele("Tipo").txt(FE_EMISOR.tipoIdentificacion);
  idEmEl.ele("Numero").txt(FE_EMISOR.identificacion);
  const ubEl = emisorEl.ele("Ubicacion");
  ubEl.ele("Provincia").txt(FE_EMISOR.ubicacion.provincia);
  ubEl.ele("Canton").txt(FE_EMISOR.ubicacion.canton);
  ubEl.ele("Distrito").txt(FE_EMISOR.ubicacion.distrito);
  if (FE_EMISOR.ubicacion.barrio) ubEl.ele("Barrio").txt(FE_EMISOR.ubicacion.barrio);
  ubEl.ele("OtrasSenas").txt(FE_EMISOR.ubicacion.otrasSenas);
  const telEl = emisorEl.ele("Telefono");
  telEl.ele("CodigoPais").txt(FE_EMISOR.telefono.codigoPais);
  telEl.ele("NumTelefono").txt(FE_EMISOR.telefono.numTelefono);
  emisorEl.ele("CorreoElectronico").txt(FE_EMISOR.correo);

  // ─── Receptor (opcional si no hay identificación) ────────────────────────
  const contactName   = invoice.contactName   || "";
  const contactIdNum  = invoice.contactIdNumber ? String(invoice.contactIdNumber).replace(/\D/g, "") : "";
  // El tipo declarado manda. Solo se deduce del largo cuando la factura es
  // anterior a que se guardara, porque jurídica y NITE tienen los mismos
  // 10 dígitos y ahí adivinar se equivoca justo con quien pide deducible.
  const idType        = invoice.contactIdType || inferIdType(contactIdNum);

  if (contactName) {
    const recEl = root.ele("Receptor");
    recEl.ele("Nombre").txt(contactName.substring(0, 100));
    if (idType && contactIdNum) {
      const idRecEl = recEl.ele("Identificacion");
      idRecEl.ele("Tipo").txt(idType);
      idRecEl.ele("Numero").txt(contactIdNum);
    }
    if (invoice.contact?.email) {
      recEl.ele("CorreoElectronico").txt(invoice.contact.email);
    }
  }

  root.ele("CondicionVenta").txt(condVenta);
  if (isCredit && dueDate) {
    const diffDays = Math.ceil((dueDate - invoiceDate) / (1000 * 60 * 60 * 24));
    root.ele("PlazoCredito").txt(String(diffDays));
  }

  // ─── Detalle de líneas ───────────────────────────────────────────────────
  const detalleEl = root.ele("DetalleServicio");

  let totalServGravados       = 0;
  let totalServExentos        = 0;
  let totalMercanciasGravadas = 0;
  let totalMercanciasExentas  = 0;
  let totalVenta              = 0;
  let totalDescuentos         = 0;
  let totalImpuesto           = 0;

  // Desglose del impuesto por tarifa: la 4.4 lo exige agrupado en el resumen.
  const desglose = new Map();

  lines.forEach((line, idx) => {
    const lineEl = detalleEl.ele("LineaDetalle");
    lineEl.ele("NumeroLinea").txt(String(idx + 1));

    // En 4.4 el CABYS es un elemento propio, ya no va envuelto en CodigoHacienda,
    // y es OBLIGATORIO: es el primer hijo que el esquema espera dentro de
    // LineaDetalle. Omitirlo no produce un documento incompleto sino uno
    // inválido, y Hacienda lo rechaza señalando el elemento siguiente
    // ("Invalid content was found starting with element ...Cantidad"), que no
    // dice nada sobre la causa real. Pasó con la factura 0154: ningún servicio
    // tenía CABYS asignado. Se corta acá, antes de firmar y de gastar un
    // consecutivo, con un mensaje que nombra el servicio a corregir.
    const cabys = line.product?.cabysCode || line.service?.cabysCode || line.cabysCode || "";
    if (!cabys) {
      const queCosa = line.productName || line.description || `línea ${idx + 1}`;
      throw new Error(
        `Falta el código CABYS de «${queCosa}». Hacienda lo exige en cada línea. ` +
          "Asígnelo en el servicio desde el panel de administración antes de facturar."
      );
    }
    lineEl.ele("CodigoCABYS").txt(cabys);

    const qty     = round2(line.quantity || 1);
    const uprice  = round2(line.unitPrice || 0);
    const discPct = round2(line.discountPercent || 0);
    const taxRate = round2(line.taxRate || 0);

    const montoTotal   = round2(qty * uprice);
    const descMonto    = discPct > 0 ? round2(montoTotal * discPct / 100) : 0;
    const subtotalLine = round2(montoTotal - descMonto);
    const taxMonto     = round2(line.taxAmount || 0);
    const totalLinea   = round2(subtotalLine + taxMonto);

    // Unidad de medida: default "Sp" (servicios profesionales)
    const uom = line.product?.saleUom || "Sp";

    lineEl.ele("Cantidad").txt(fmt5(qty));
    lineEl.ele("UnidadMedida").txt(uom);
    lineEl.ele("Detalle").txt(
      (line.product?.name || line.service?.title || line.description || `Servicio ${idx + 1}`).substring(0, 200)
    );
    lineEl.ele("PrecioUnitario").txt(fmt5(uprice));
    lineEl.ele("MontoTotal").txt(fmt5(montoTotal));

    if (descMonto > 0) {
      const descEl = lineEl.ele("Descuento");
      descEl.ele("MontoDescuento").txt(fmt5(descMonto));
      descEl.ele("CodigoDescuento").txt("07");
      descEl.ele("NaturalezaDescuento").txt("Descuento Comercial");
      totalDescuentos = round2(totalDescuentos + descMonto);
    }

    lineEl.ele("SubTotal").txt(fmt5(subtotalLine));
    lineEl.ele("BaseImponible").txt(fmt5(subtotalLine));

    totalVenta = round2(totalVenta + montoTotal);

    if (taxRate > 0 && taxMonto > 0) {
      const codigoTarifa = ivaTarifaCodigo(taxRate);

      const impEl = lineEl.ele("Impuesto");
      impEl.ele("Codigo").txt("01"); // 01=IVA
      impEl.ele("CodigoTarifaIVA").txt(codigoTarifa);
      impEl.ele("Tarifa").txt(fmt2(taxRate));
      impEl.ele("Monto").txt(fmt2(taxMonto));

      lineEl.ele("ImpuestoAsumidoEmisorFabrica").txt("0.00");
      lineEl.ele("ImpuestoNeto").txt(fmt2(taxMonto));

      totalImpuesto = round2(totalImpuesto + taxMonto);
      totalServGravados = round2(totalServGravados + montoTotal);
      desglose.set(codigoTarifa, round2((desglose.get(codigoTarifa) || 0) + taxMonto));
    } else {
      lineEl.ele("ImpuestoAsumidoEmisorFabrica").txt("0.00");
      lineEl.ele("ImpuestoNeto").txt("0.00");
      totalServExentos = round2(totalServExentos + montoTotal);
    }

    lineEl.ele("MontoTotalLinea").txt(fmt5(totalLinea));
  });

  // ─── InformacionReferencia (solo para notas de crédito) ──────────────────
  if (
    (invoice.invoiceType === "CUSTOMER_CREDIT_NOTE" ||
      invoice.invoiceType === "SUPPLIER_CREDIT_NOTE") &&
    invoice.originDocument
  ) {
    const refEl = root.ele("InformacionReferencia");
    refEl.ele("TipoDoc").txt("01"); // 01=Factura Electrónica original
    refEl.ele("Numero").txt(String(invoice.originDocument));
    if (invoice.originInvoice?.invoiceDate) {
      refEl.ele("FechaEmision").txt(feCrDate(invoice.originInvoice.invoiceDate));
    }
    refEl.ele("Codigo").txt("01"); // 01=Anula comprobante referenciado
    refEl.ele("Razon").txt(
      (invoice.notes || "Anulación de comprobante electrónico").substring(0, 180)
    );
  }

  // ─── Resumen Factura ─────────────────────────────────────────────────────
  const discountAmount = round2(invoice.discountAmount || totalDescuentos);
  const total          = round2(invoice.total || 0);
  const ventaNeta      = round2(totalVenta - discountAmount);

  const resumenEl = root.ele("ResumenFactura");
  const monedaEl  = resumenEl.ele("CodigoTipoMoneda");
  monedaEl.ele("CodigoMoneda").txt(currency);
  monedaEl.ele("TipoCambio").txt(fmt5(1)); // Solo CRC por ahora

  // Solo se emiten los totales con contenido: los opcionales en cero se omiten,
  // igual que en el comprobante de referencia.
  if (totalServGravados > 0) resumenEl.ele("TotalServGravados").txt(fmt5(totalServGravados));
  if (totalServExentos > 0)  resumenEl.ele("TotalServExentos").txt(fmt5(totalServExentos));
  if (totalMercanciasGravadas > 0) resumenEl.ele("TotalMercanciasGravadas").txt(fmt5(totalMercanciasGravadas));
  if (totalMercanciasExentas > 0)  resumenEl.ele("TotalMercanciasExentas").txt(fmt5(totalMercanciasExentas));

  resumenEl.ele("TotalGravado").txt(fmt5(round2(totalServGravados + totalMercanciasGravadas)));
  if (totalServExentos + totalMercanciasExentas > 0) {
    resumenEl.ele("TotalExento").txt(fmt5(round2(totalServExentos + totalMercanciasExentas)));
  }
  resumenEl.ele("TotalVenta").txt(fmt5(totalVenta));
  resumenEl.ele("TotalDescuentos").txt(fmt5(discountAmount));
  resumenEl.ele("TotalVentaNeta").txt(fmt5(ventaNeta));

  for (const [codigoTarifa, monto] of desglose) {
    const desgEl = resumenEl.ele("TotalDesgloseImpuesto");
    desgEl.ele("Codigo").txt("01");
    desgEl.ele("CodigoTarifaIVA").txt(codigoTarifa);
    desgEl.ele("TotalMontoImpuesto").txt(fmt2(monto));
  }

  resumenEl.ele("TotalImpuesto").txt(fmt2(totalImpuesto));

  const medioEl = resumenEl.ele("MedioPago");
  medioEl.ele("TipoMedioPago").txt(medioPago);
  medioEl.ele("TotalMedioPago").txt(fmt2(total));

  resumenEl.ele("TotalComprobante").txt(fmt2(total));

  const xml = root.end({ prettyPrint: false, headless: true });

  return { xml, feNumber, feClave };
}
