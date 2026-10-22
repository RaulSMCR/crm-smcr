// src/lib/fe/factura-pdf.js
//
// La representación imprimible de un comprobante electrónico aceptado: lo que
// el cliente imprime o presenta ante su aseguradora. El documento con validez
// es el XML firmado; esto lo acompaña, nunca lo reemplaza.
//
// Contenido: el de una factura de referencia (la 0202 del sistema anterior) —
// emisor, cliente, detalle con descuento e impuesto, totales, consecutivo y
// clave—. Diseño: con la identidad de Salud Mental Costa Rica (paleta del sitio,
// hoja de la marca y sitio web), porque es un papel que circula y la presenta.
// Las fechas se escriben en hora de Costa Rica.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { MEDIO_PAGO_MAP, TIPO_DOC_MAP, tipoComprobanteDe } from "./config.js";
import { HOJA_PNG_BASE64 } from "./marca-factura.js";
import { SITE_URL } from "@/lib/site-url";

const ETIQUETA_MEDIO_PAGO = {
  "01": "Efectivo",
  "02": "Tarjeta",
  "03": "Cheque",
  "04": "Transferencia o depósito bancario",
  "05": "Recaudado por terceros",
  "06": "SINPE Móvil",
  "07": "Plataforma digital",
  "99": "Otro",
};

/** Paleta del sitio (src/app/globals.css). */
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const MARCA = {
  tealDeep: hex("#1E4F52"),
  teal: hex("#2B7073"),
  tealPale: hex("#8FBDBB"),
  cream: hex("#F6EFDF"),
  creamHi: hex("#FBF8F1"),
  coral: hex("#FB7A62"),
  tinta: hex("#1F2A2E"),
  gris: hex("#5E6B6E"),
  blanco: rgb(1, 1, 1),
};

const ANCHO = 612;
const ALTO = 792;
const MARGEN = 48;
const DERECHA = ANCHO - MARGEN;
const PIE = 46;

/** El medio de pago tal como se declaró en el XML (misma tabla que xml.js). */
export function etiquetaMedioDePago(paymentMethod) {
  const codigo = MEDIO_PAGO_MAP[String(paymentMethod || "").toLowerCase()] || "04";
  return ETIQUETA_MEDIO_PAGO[codigo] || "Otro";
}

function fechaCR(value) {
  return new Intl.DateTimeFormat("es-CR", { timeZone: "America/Costa_Rica", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

/** "CRC 38 461,54": formato tico, con espacio común para que se copie bien. */
function dinero(value) {
  const n = Number(value || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `CRC ${n.replace(/[  ]/g, " ")}`;
}

/** ¿Se puede imprimir? Solo un comprobante aceptado por Hacienda y vigente. */
export function facturaImprimible(invoice) {
  return invoice?.feStatus === "ACCEPTED" && Boolean(invoice.feXml && invoice.feNumber && invoice.feClave) && ["PAID", "OPEN"].includes(invoice.status);
}

/**
 * @param {object} invoice  Con sus `lines` y, si se tiene, `contact.email`.
 * @param {object} issuer   FE_EMISOR.
 * @returns {Promise<Buffer>}
 */
export async function facturaPdf(invoice, issuer) {
  if (!facturaImprimible(invoice)) throw new Error("FACTURA_NO_IMPRIMIBLE");

  const doc = await PDFDocument.create();
  doc.setTitle(`Factura electrónica ${invoice.invoiceNumber} — Salud Mental Costa Rica`);
  doc.setAuthor(issuer.nombre || "Salud Mental Costa Rica");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const hoja = await doc.embedPng(Buffer.from(HOJA_PNG_BASE64, "base64"));
  const sitio = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Helvetica estándar solo codifica Latin-1: lo que no entre (un nombre con
  // otro alfabeto) se escribe sin tildes antes que romper el PDF entero.
  const seguro = (texto, f = font) => {
    const t = String(texto ?? "");
    try { f.widthOfTextAtSize(t, 10); return t; } catch {
      return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\xFF]/g, "?");
    }
  };

  let page;
  let y;
  const texto = (t, x, size = 10, f = font, color = MARCA.tinta) => page.drawText(seguro(t, f), { x, y, size, font: f, color });
  const derecha = (t, xDerecha, size = 10, f = font, color = MARCA.tinta) => {
    const s = seguro(t, f);
    page.drawText(s, { x: xDerecha - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  };
  const rotulo = (t, x) => texto(t.toUpperCase(), x, 7.5, bold, MARCA.teal);
  /** Corta un texto largo en renglones que caben en `ancho`. */
  const renglones = (t, ancho, size = 10, f = font) => {
    const palabras = seguro(t, f).split(/\s+/);
    const out = [];
    let linea = "";
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p;
      if (f.widthOfTextAtSize(prueba, size) > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
    }
    if (linea) out.push(linea);
    return out;
  };

  /** Pie de marca: va en todas las páginas. */
  const pie = () => {
    page.drawRectangle({ x: 0, y: 0, width: ANCHO, height: PIE - 12, color: MARCA.tealDeep });
    page.drawRectangle({ x: 0, y: PIE - 12, width: ANCHO, height: 2, color: MARCA.coral });
    // La marca en negrita y el sitio en regular, centrados como una sola línea.
    const marca = "Salud Mental Costa Rica";
    const resto = `   ·   ${sitio}`;
    const anchoMarca = bold.widthOfTextAtSize(marca, 9);
    const x = (ANCHO - anchoMarca - font.widthOfTextAtSize(resto, 9)) / 2;
    page.drawText(marca, { x, y: 13, size: 9, font: bold, color: MARCA.cream });
    page.drawText(resto, { x: x + anchoMarca, y: 13, size: 9, font, color: MARCA.cream });
  };
  const nuevaPagina = () => {
    page = doc.addPage([ANCHO, ALTO]);
    pie();
    y = ALTO - 56;
  };
  const saltar = (dy) => {
    y -= dy;
    if (y < PIE + 30) nuevaPagina();
  };

  // ── Encabezado de marca ────────────────────────────────────────────────────
  page = doc.addPage([ANCHO, ALTO]);
  pie();
  const ALTO_BANDA = 112;
  page.drawRectangle({ x: 0, y: ALTO - ALTO_BANDA, width: ANCHO, height: ALTO_BANDA, color: MARCA.cream });
  page.drawRectangle({ x: 0, y: ALTO - ALTO_BANDA - 3, width: ANCHO, height: 3, color: MARCA.coral });
  page.drawImage(hoja, { x: MARGEN, y: ALTO - 92, width: 62, height: 62 });
  y = ALTO - 52; texto("Salud Mental", MARGEN + 76, 18, bold, MARCA.tealDeep);
  y = ALTO - 70; texto("Costa Rica", MARGEN + 76, 13, font, MARCA.teal);
  y = ALTO - 86; texto(sitio, MARGEN + 76, 8.5, font, MARCA.gris);

  const esTiquete = tipoComprobanteDe(invoice) === TIPO_DOC_MAP.TIQUETE_ELECTRONICO;
  y = ALTO - 46; derecha(esTiquete ? "TIQUETE ELECTRÓNICO" : "FACTURA ELECTRÓNICA", DERECHA, 9, bold, MARCA.teal);
  y = ALTO - 72; derecha(`Nº ${invoice.invoiceNumber}`, DERECHA, 24, bold, MARCA.tealDeep);
  y = ALTO - 90; derecha(`Fecha: ${fechaCR(invoice.invoiceDate)}`, DERECHA, 9.5, font, MARCA.gris);
  y = ALTO - ALTO_BANDA - 34;

  if (invoice.feAmbiente !== "01") {
    texto("COMPROBANTE DE PRUEBAS - SIN VALIDEZ TRIBUTARIA", MARGEN, 11, bold, rgb(0.7, 0.1, 0.1));
    saltar(24);
  }

  // ── Emisor y cliente ───────────────────────────────────────────────────────
  const COL_CLIENTE = 318;
  const yColumnas = y;
  rotulo("Emitida por", MARGEN); saltar(14);
  for (const r of renglones(issuer.nombre, 240, 10.5, bold)) { texto(r, MARGEN, 10.5, bold); saltar(14); }
  texto(`Cédula jurídica ${issuer.identificacion}`, MARGEN, 9); saltar(12);
  if (issuer.ubicacion?.otrasSenas) { texto(issuer.ubicacion.otrasSenas, MARGEN, 9, font, MARCA.gris); saltar(12); }
  const contacto = [issuer.telefono?.numTelefono && `Tel. ${issuer.telefono.numTelefono}`, issuer.correo].filter(Boolean).join("  ·  ");
  if (contacto) { texto(contacto, MARGEN, 9, font, MARCA.gris); saltar(12); }
  const yFinEmisor = y;

  // El cliente va sobre un fondo crema: es lo primero que busca quien la recibe.
  const correo = invoice.contact?.billingEmail || invoice.contact?.email;
  const nombreCliente = renglones(invoice.contactName, 210, 10.5, bold);
  const altoCliente = 30 + nombreCliente.length * 14 + (invoice.contactIdNumber ? 12 : 0) + (correo ? 12 : 0);
  page.drawRectangle({ x: COL_CLIENTE - 12, y: yColumnas - altoCliente + 16, width: DERECHA - COL_CLIENTE + 12, height: altoCliente, color: MARCA.creamHi, borderColor: MARCA.cream, borderWidth: 1 });
  y = yColumnas;
  rotulo("Facturada a", COL_CLIENTE); saltar(14);
  for (const r of nombreCliente) { texto(r, COL_CLIENTE, 10.5, bold); saltar(14); }
  if (invoice.contactIdNumber) { texto(`Identificación ${invoice.contactIdNumber}`, COL_CLIENTE, 9); saltar(12); }
  if (correo) { texto(correo, COL_CLIENTE, 9, font, MARCA.gris); saltar(12); }
  y = Math.min(y, yFinEmisor);
  saltar(22);

  // ── Detalle ────────────────────────────────────────────────────────────────
  // Borde derecho de cada columna numérica; la descripción va a la izquierda.
  const COL = { desc: MARGEN + 8, descAncho: 186, cant: 282, precio: 362, descPct: 410, iva: 474, monto: DERECHA - 8 };
  page.drawRectangle({ x: MARGEN, y: y - 7, width: DERECHA - MARGEN, height: 22, color: MARCA.teal });
  texto("Descripción", COL.desc, 8.5, bold, MARCA.blanco);
  derecha("Cant.", COL.cant, 8.5, bold, MARCA.blanco);
  derecha("Precio unidad", COL.precio, 8.5, bold, MARCA.blanco);
  derecha("Desc.(%)", COL.descPct, 8.5, bold, MARCA.blanco);
  derecha("Impuesto", COL.iva, 8.5, bold, MARCA.blanco);
  derecha("Monto", COL.monto, 8.5, bold, MARCA.blanco);
  saltar(28);

  for (const linea of invoice.lines || []) {
    const descripcion = [linea.productName, linea.description].filter(Boolean).filter((p, i, t) => t.indexOf(p) === i).join(" — ");
    const partes = renglones(descripcion || "Servicio", COL.descAncho);
    texto(partes[0], COL.desc);
    derecha(Number(linea.quantity).toLocaleString("es-CR"), COL.cant);
    derecha(dinero(linea.unitPrice).replace("CRC ", ""), COL.precio);
    derecha(Number(linea.discountPercent || 0).toLocaleString("es-CR"), COL.descPct);
    derecha(Number(linea.taxRate) > 0 ? `IVA (${Number(linea.taxRate)}%)` : "Exento", COL.iva);
    derecha(dinero(linea.lineTotal), COL.monto);
    for (const extra of partes.slice(1)) { saltar(12); texto(extra, COL.desc); }
    if (linea.cabysCode) { saltar(12); texto(`CABYS ${linea.cabysCode}`, COL.desc, 7.5, font, MARCA.gris); }
    if (Number(linea.discountPercent) > 0 && linea.discountType) { saltar(12); texto(`Descuento: ${linea.discountType}`, COL.desc, 7.5, font, MARCA.gris); }
    saltar(10);
    page.drawLine({ start: { x: MARGEN, y: y + 2 }, end: { x: DERECHA, y: y + 2 }, thickness: 0.6, color: MARCA.tealPale });
    saltar(14);
  }
  saltar(4);

  // ── Totales ────────────────────────────────────────────────────────────────
  const X_TOTALES = 360;
  const fila = (etiqueta, valor) => { texto(etiqueta, X_TOTALES, 9.5, font, MARCA.gris); derecha(valor, COL.monto, 9.5); saltar(15); };
  fila("Subtotal", dinero(invoice.subtotal));
  if (Number(invoice.discountAmount) > 0) fila("Descuentos", `- ${dinero(invoice.discountAmount)}`);
  fila("IVA", dinero(invoice.taxAmount));
  saltar(8);
  page.drawRectangle({ x: X_TOTALES - 10, y: y - 8, width: DERECHA - X_TOTALES + 10, height: 24, color: MARCA.teal });
  texto("Total", X_TOTALES, 11, bold, MARCA.blanco);
  derecha(dinero(invoice.total), COL.monto, 12, bold, MARCA.blanco);
  saltar(36);
  texto("Medio de pago: ", MARGEN, 9.5, bold, MARCA.teal);
  texto(etiquetaMedioDePago(invoice.paymentMethod), MARGEN + bold.widthOfTextAtSize("Medio de pago: ", 9.5), 9.5);
  saltar(30);

  // ── Identificación fiscal ──────────────────────────────────────────────────
  const altoFiscal = 62;
  if (y - altoFiscal < PIE + 30) nuevaPagina();
  page.drawRectangle({ x: MARGEN, y: y - altoFiscal + 14, width: DERECHA - MARGEN, height: altoFiscal, color: MARCA.creamHi, borderColor: MARCA.cream, borderWidth: 1 });
  rotulo("Consecutivo", MARGEN + 12); saltar(12);
  texto(invoice.feNumber, MARGEN + 12, 9.5, bold); saltar(18);
  rotulo("Clave numérica", MARGEN + 12); saltar(12);
  texto(invoice.feClave, MARGEN + 12, 9.5, bold); saltar(30);
  for (const r of renglones("Emitida conforme a la resolución de comprobantes electrónicos de la Dirección General de Tributación (versión 4.4). Esta es la representación impresa del comprobante electrónico; conserve también el XML aceptado por el Ministerio de Hacienda.", DERECHA - MARGEN, 7.5)) {
    texto(r, MARGEN, 7.5, font, MARCA.gris); saltar(10);
  }

  return Buffer.from(await doc.save());
}
