// src/lib/fe/xml.js
// Genera el XML de Factura Electrónica v4.3 para Hacienda CR.

import { create } from "xmlbuilder2";
import {
  FE_EMISOR,
  TIPO_DOC_MAP,
  MEDIO_PAGO_MAP,
  NS_MAP,
  ROOT_ELEMENT_MAP,
} from "./config.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fmt2   = (n) => round2(n).toFixed(2);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Formatea fecha en ISO 8601 con zona horaria CR (-06:00) */
function feCrDate(date) {
  const d   = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-06:00`
  );
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

/** Genera la Clave de 50 dígitos */
export function buildFeClave(tipoDoc, feNumber, invoiceDate, securityCode) {
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

/** Extrae consecutivo numérico de un invoiceNumber */
export function extractConsecutivo(invoiceNumber) {
  const parts = String(invoiceNumber || "1").split("/");
  return Math.abs(parseInt(parts[parts.length - 1] || "1", 10)) || 1;
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
  const feClave    = buildFeClave(tipoDoc, feNumber, invoice.invoiceDate);
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
  root.ele("CodigoActividad").txt(invoice.economicActivity || FE_EMISOR.actividadEconomica);
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
  ubEl.ele("OtrasSenas").txt(FE_EMISOR.ubicacion.otrasSenas);
  const telEl = emisorEl.ele("Telefono");
  telEl.ele("CodigoPais").txt(FE_EMISOR.telefono.codigoPais);
  telEl.ele("NumTelefono").txt(FE_EMISOR.telefono.numTelefono);
  emisorEl.ele("CorreoElectronico").txt(FE_EMISOR.correo);

  // ─── Receptor (opcional si no hay identificación) ────────────────────────
  const contactName   = invoice.contactName   || "";
  const contactIdNum  = invoice.contactIdNumber ? String(invoice.contactIdNumber).replace(/\D/g, "") : "";
  const idType        = inferIdType(contactIdNum);

  if (contactName) {
    const recEl = root.ele("Receptor");
    recEl.ele("Nombre").txt(contactName.substring(0, 100));
    if (idType && contactIdNum) {
      const idRecEl = recEl.ele("Identificacion");
      idRecEl.ele("Tipo").txt(idType);
      idRecEl.ele("Numero").txt(contactIdNum);
    }
    // CorreoElectronico del receptor (si está disponible en contact)
    if (invoice.contact?.email) {
      recEl.ele("CorreoElectronico").txt(invoice.contact.email);
    }
  }

  root.ele("CondicionVenta").txt(condVenta);
  if (isCredit && dueDate) {
    const diffDays = Math.ceil((dueDate - invoiceDate) / (1000 * 60 * 60 * 24));
    root.ele("PlazoCredito").txt(String(diffDays));
  }
  root.ele("MedioPago").txt(medioPago);

  // ─── Detalle de líneas ───────────────────────────────────────────────────
  const detalleEl = root.ele("DetalleServicio");

  let totalServGravados       = 0;
  let totalServExentos        = 0;
  let totalMercanciasGravadas = 0;
  let totalMercanciasExentas  = 0;
  let totalDescuentos         = 0;
  let totalImpuesto           = 0;

  lines.forEach((line, idx) => {
    const lineEl = detalleEl.ele("LineaDetalle");
    lineEl.ele("NumeroLinea").txt(String(idx + 1));

    // Código CABYS (prioridad: product.cabysCode)
    const cabys = line.product?.cabysCode || "";
    if (cabys) {
      const codEl = lineEl.ele("CodigoHacienda");
      codEl.ele("Tipo").txt("04"); // 04=CABYS
      codEl.ele("Codigo").txt(cabys);
    }

    const qty     = round2(line.quantity || 1);
    const uprice  = round2(line.unitPrice || 0);
    const discPct = round2(line.discountPercent || 0);
    const taxRate = round2(line.taxRate || 0);

    const montoTotal  = round2(qty * uprice);
    const descMonto   = discPct > 0 ? round2(montoTotal * discPct / 100) : 0;
    const subtotalLine = round2(montoTotal - descMonto);
    const taxMonto    = round2(line.taxAmount || 0);
    const totalLinea  = round2(subtotalLine + taxMonto);

    // Unidad de medida: default "Sp" (servicios profesionales)
    const uom = line.product?.saleUom || "Sp";

    lineEl.ele("Cantidad").txt(fmt2(qty));
    lineEl.ele("UnidadMedida").txt(uom);
    lineEl.ele("Detalle").txt(
      (line.product?.name || line.description || `Servicio ${idx + 1}`).substring(0, 200)
    );
    lineEl.ele("PrecioUnitario").txt(fmt2(uprice));
    lineEl.ele("MontoTotal").txt(fmt2(montoTotal));

    if (descMonto > 0) {
      const descEl = lineEl.ele("Descuento");
      descEl.ele("MontoDescuento").txt(fmt2(descMonto));
      descEl.ele("NaturalezaDescuento").txt("Descuento comercial");
      totalDescuentos = round2(totalDescuentos + descMonto);
    }

    lineEl.ele("SubTotal").txt(fmt2(subtotalLine));

    // Impuesto IVA
    if (taxRate > 0 && taxMonto > 0) {
      const impEl = lineEl.ele("Impuesto");
      impEl.ele("Codigo").txt("01"); // 01=IVA
      impEl.ele("CodigoTarifa").txt(ivaTarifaCodigo(taxRate));
      impEl.ele("Tarifa").txt(fmt2(taxRate));
      impEl.ele("Monto").txt(fmt2(taxMonto));

      lineEl.ele("ImpuestoNeto").txt(fmt2(taxMonto));
      totalImpuesto = round2(totalImpuesto + taxMonto);
      totalServGravados = round2(totalServGravados + subtotalLine);
    } else {
      lineEl.ele("ImpuestoNeto").txt("0.00");
      totalServExentos = round2(totalServExentos + subtotalLine);
    }

    lineEl.ele("MontoTotalLinea").txt(fmt2(totalLinea));
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
  const subtotal        = round2(invoice.subtotal || 0);
  const taxAmount       = round2(invoice.taxAmount || 0);
  const discountAmount  = round2(invoice.discountAmount || totalDescuentos);
  const total           = round2(invoice.total || 0);
  const ventaNeta       = round2(subtotal - discountAmount);

  const resumenEl = root.ele("ResumenFactura");
  const monedaEl  = resumenEl.ele("CodigoTipoMoneda");
  monedaEl.ele("CodigoMoneda").txt(currency);
  monedaEl.ele("TipoCambio").txt("1.00"); // Solo CRC por ahora

  resumenEl.ele("TotalServGravados").txt(fmt2(totalServGravados));
  resumenEl.ele("TotalServExentos").txt(fmt2(totalServExentos));
  resumenEl.ele("TotalServExonerados").txt("0.00");
  resumenEl.ele("TotalMercanciasGravadas").txt(fmt2(totalMercanciasGravadas));
  resumenEl.ele("TotalMercanciasExentas").txt(fmt2(totalMercanciasExentas));
  resumenEl.ele("TotalMercanciasExoneradas").txt("0.00");
  resumenEl.ele("TotalGravado").txt(fmt2(round2(totalServGravados + totalMercanciasGravadas)));
  resumenEl.ele("TotalExento").txt(fmt2(round2(totalServExentos + totalMercanciasExentas)));
  resumenEl.ele("TotalExonerado").txt("0.00");
  resumenEl.ele("TotalVenta").txt(fmt2(subtotal));
  resumenEl.ele("TotalDescuentos").txt(fmt2(discountAmount));
  resumenEl.ele("TotalVentaNeta").txt(fmt2(ventaNeta));
  resumenEl.ele("TotalImpuesto").txt(fmt2(taxAmount));
  resumenEl.ele("TotalIVADevuelto").txt("0.00");
  resumenEl.ele("TotalOtrosCargos").txt("0.00");
  resumenEl.ele("TotalComprobante").txt(fmt2(total));

  const xml = root.end({ prettyPrint: false, headless: true });

  return { xml, feNumber, feClave };
}

/** Devuelve el código de tarifa de IVA según el porcentaje */
function ivaTarifaCodigo(rate) {
  const r = round2(rate);
  if (r === 0)   return "01"; // Exento
  if (r === 1)   return "02";
  if (r === 2)   return "03";
  if (r === 4)   return "04";
  if (r === 8)   return "05";
  if (r === 13)  return "06";
  return "07"; // Variable
}
