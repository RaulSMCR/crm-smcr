import { DOMParser } from "@xmldom/xmldom";
import { validateSupplierFeClave } from "@/lib/supplier-invoice";
import { round2 } from "@/lib/invoice-math";

export const MAX_SUPPLIER_XML_BYTES = 5 * 1024 * 1024;

export class SupplierXmlError extends Error {}
const invalid = (message) => { throw new SupplierXmlError(message); };

// Solo hijos directos del namespace de la factura: nunca datos de la firma
// o de otros documentos anidados. Los campos escalares no admiten duplicados.
const children = (node, name) => Array.from(node?.childNodes || []).filter(
  (el) => el.nodeType === 1 && el.localName === name && el.namespaceURI === node.namespaceURI
);
function child(node, name) {
  const matches = children(node, name);
  if (matches.length > 1) invalid(`El XML contiene el campo ${name} duplicado.`);
  return matches[0];
}
function value(node, name, optional = false) {
  const el = child(node, name);
  if (Array.from(el?.childNodes || []).some((n) => n.nodeType === 1)) invalid(`El campo ${name} no es válido.`);
  const text = el?.textContent?.trim() || "";
  if (!text && !optional) invalid(`Falta el campo ${name} en el XML de la factura.`);
  return text;
}
function decimal(node, name, optional = false) {
  const text = value(node, name, optional);
  if (!text && optional) return 0;
  if (!/^\d+(\.\d{1,5})?$/.test(text) || Number(text) > 9999999999999) invalid(`El monto ${name} no es válido.`);
  return Number(text);
}
function agrees(a, b) { return Math.abs(round2(a) - round2(b)) < 0.011; }

/** Lee el comprobante; no certifica su firma ni su aceptación ante Hacienda. */
export function parseSupplierInvoiceXml(xml, identification) {
  if (typeof xml !== "string" || !xml.trim() || Buffer.byteLength(xml, "utf8") > MAX_SUPPLIER_XML_BYTES) {
    invalid("El XML está vacío o supera el máximo de 5MB.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) invalid("El XML no puede contener DTD ni entidades externas.");
  let doc;
  try {
    doc = new DOMParser({ onError: () => { throw new Error("XML inválido"); } }).parseFromString(xml.replace(/^\uFEFF/, ""), "text/xml");
  } catch {
    invalid("El XML está mal formado. Seleccione el comprobante original de la factura.");
  }
  const root = doc.documentElement;
  if (root?.localName !== "FacturaElectronica") invalid("Seleccione el XML de una FacturaElectronica, no una respuesta de Hacienda ni otro comprobante.");
  const supplierFeClave = value(root, "Clave");
  const referenceNumber = value(root, "NumeroConsecutivo");
  const emitter = child(root, "Emisor");
  const supplierIdNumber = value(child(emitter, "Identificacion"), "Numero");
  const claveCheck = validateSupplierFeClave(supplierFeClave, identification);
  if (!claveCheck.ok) invalid(claveCheck.error);
  if (!/^\d{9,12}$/.test(supplierIdNumber) || supplierIdNumber.padStart(12, "0") !== supplierFeClave.slice(9, 21)) {
    invalid("La identificación del emisor del XML no coincide con la del profesional.");
  }
  if (!/^\d{20}$/.test(referenceNumber) || referenceNumber !== supplierFeClave.slice(21, 41)) {
    invalid("El consecutivo del XML no coincide con la clave numérica.");
  }
  const invoiceDate = value(root, "FechaEmision");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(invoiceDate) || !Number.isFinite(Date.parse(invoiceDate))) {
    invalid("La fecha de emisión del XML no es válida.");
  }
  const summary = child(root, "ResumenFactura");
  const currency = value(child(summary, "CodigoTipoMoneda"), "CodigoMoneda");
  if (currency !== "CRC") invalid("Las facturas de profesionales deben estar expresadas en CRC.");
  const subtotal = decimal(summary, "TotalVentaNeta");
  const taxAmount = decimal(summary, "TotalImpuesto", true);
  const discountAmount = decimal(summary, "TotalDescuentos", true);
  const amount = decimal(summary, "TotalComprobante");
  if (decimal(summary, "TotalOtrosCargos", true) || decimal(summary, "TotalIVADevuelto", true)) {
    invalid("Esta factura incluye otros cargos o IVA devuelto que requieren revisión administrativa.");
  }
  if (amount <= 0 || !agrees(subtotal + taxAmount, amount) || !agrees(decimal(summary, "TotalVenta") - discountAmount, subtotal)) {
    invalid("Los totales del XML no son consistentes.");
  }
  const lines = children(child(root, "DetalleServicio"), "LineaDetalle").map((line, sortOrder) => {
    const quantity = decimal(line, "Cantidad");
    const unitPrice = decimal(line, "PrecioUnitario");
    const gross = decimal(line, "MontoTotal");
    const lineSubtotal = decimal(line, "SubTotal");
    const lineTotal = decimal(line, "MontoTotalLinea");
    const discounts = children(line, "Descuento").reduce((sum, item) => sum + decimal(item, "MontoDescuento"), 0);
    const taxes = children(line, "Impuesto");
    const calculatedTax = taxes.reduce((sum, item) => sum + decimal(item, "Monto") - decimal(child(item, "Exoneracion"), "MontoExoneracion", true), 0);
    const lineTax = child(line, "ImpuestoNeto") ? decimal(line, "ImpuestoNeto") : calculatedTax;
    const taxRate = taxes.reduce((sum, item) => sum + decimal(item, "Tarifa"), 0);
    if (quantity <= 0 || taxRate > 100 || !agrees(quantity * unitPrice, gross) || !agrees(gross - discounts, lineSubtotal) || !agrees(lineSubtotal + lineTax, lineTotal)) {
      invalid("El detalle del XML contiene montos inconsistentes.");
    }
    return {
      productName: value(line, "Detalle"), cabysCode: value(line, "CodigoCABYS", true) || null,
      quantity: round2(quantity), unitPrice: round2(unitPrice), discountPercent: gross ? round2(discounts / gross * 100) : 0,
      taxRate: round2(taxRate), taxAmount: round2(lineTax), lineSubtotal: round2(lineSubtotal), lineTotal: round2(lineTotal), sortOrder,
    };
  });
  if (!lines.length || !agrees(lines.reduce((s, l) => s + l.lineSubtotal, 0), subtotal) || !agrees(lines.reduce((s, l) => s + l.taxAmount, 0), taxAmount)) {
    invalid("El detalle del XML no coincide con el resumen de la factura.");
  }
  return {
    referenceNumber, supplierFeClave, supplierIdNumber, supplierName: value(emitter, "Nombre"), invoiceDate, currency,
    subtotal: round2(subtotal), taxAmount: round2(taxAmount), discountAmount: round2(discountAmount), amount: round2(amount), lines,
    supplierEconomicActivity: value(root, "CodigoActividadEmisor", true) || value(root, "CodigoActividad", true) || null,
  };
}
