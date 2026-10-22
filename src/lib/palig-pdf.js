import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import { facturaImprimible, facturaPdf } from "@/lib/fe/factura-pdf";
import { PALIG_FIELDS as F } from "@/lib/palig-fields";
import { fechaCostaRica } from "@/lib/palig-policy";

export class PaligError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function fechaPalig(value) {
  const iso = fechaCostaRica(value);
  if (!iso) throw new PaligError("La fecha no es válida.");
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

// ─── Dos tipos de plantilla ──────────────────────────────────────────────────
//
// EDITABLE: el formulario PALIG con sus campos (versiones 2023 y 2026, mismas
// posiciones). La fecha va en su campo.
//
// ESCANEADA: el papel que el paciente firmó a mano, digitalizado: una página
// sin campos (la de Javier, 21-oct-2026 hora CR, es una imagen de 439×713). La
// fecha se escribe encima de la imagen, en el recuadro «Fecha de servicio
// (atención)». Cada escaneo encuadra distinto, así que la posición se guarda
// DENTRO de la plantilla (en sus palabras clave) y Raúl la ajusta una vez con
// la vista previa (moverFechaPalig).

/** Recuadro de la fecha en un escaneo, en proporción a la página (origen abajo-izquierda). */
// Valor de base medido sobre el escaneo de Javier; cada plantilla lo ajusta.
export const POSICION_FECHA_ESCANEO = Object.freeze({ x: 0.213, y: 0.631, w: 0.18, h: 0.022 });
const CLAVE_POSICION = "smcr-fecha-atencion:";

function quitarAcciones(doc) {
  doc.catalog.delete(PDFName.of("OpenAction"));
  doc.catalog.delete(PDFName.of("AA"));
  doc.catalog.delete(PDFName.of("Names"));
  for (const page of doc.getPages()) page.node.delete(PDFName.of("AA"));
}

/** ¿Es el formulario PALIG editable, con sus campos en su lugar? */
function esEditable(doc) {
  const page = doc.getPages()[0];
  if (doc.getPageCount() !== 1 || Math.abs(page.getWidth() - 612) > 1 || Math.abs(page.getHeight() - 1008) > 1) return false;
  const form = doc.getForm();
  if (form.hasXFA()) return false;
  try {
    for (const name of Object.values(F)) form.getTextField(name);
    // Identificadores comunes como Text9 no bastan para reconocer un formulario.
    for (const [name, x, y] of [[F.patientName, 29.4751, 783.09], [F.serviceDate, 141.16, 612.405], [F.professionalName, 29.3481, 188.112]]) {
      const rect = form.getTextField(name).acroField.getWidgets()[0].getRectangle();
      if (Math.abs(rect.x - x) > 2 || Math.abs(rect.y - y) > 2) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function loadTemplate(bytes) {
  let doc;
  try { doc = await PDFDocument.load(bytes); } catch { throw new PaligError("El PDF no se puede leer o está protegido con contraseña."); }
  quitarAcciones(doc);
  if (esEditable(doc)) {
    const form = doc.getForm();
    for (const field of form.getFields()) {
      field.acroField.dict.delete(PDFName.of("AA"));
      for (const widget of field.acroField.getWidgets()) {
        widget.dict.delete(PDFName.of("AA"));
        widget.dict.delete(PDFName.of("A"));
      }
    }
    return { doc, form, tipo: "editable" };
  }
  // Un escaneo: una sola página vertical. Una plantilla de varias páginas o
  // apaisada no es el formulario, y escribirle una fecha sería escribir a ciegas.
  const page = doc.getPages()[0];
  const proporcion = page ? page.getHeight() / page.getWidth() : 0;
  if (doc.getPageCount() !== 1 || proporcion < 1.3 || proporcion > 1.9) {
    throw new PaligError("Suba el formulario PALIG de una sola página: el editable de esta pantalla o el papel firmado, escaneado en PDF.");
  }
  return { doc, form: null, tipo: "escaneada" };
}

/** La posición de la fecha guardada en la plantilla escaneada (o la de base). */
function posicionDe(doc) {
  const guardada = (doc.getKeywords() || "").split(/[;,]?\s+/).find((k) => k.startsWith(CLAVE_POSICION));
  if (guardada) {
    const [x, y, w, h] = guardada.slice(CLAVE_POSICION.length).split("|").map(Number);
    if ([x, y, w, h].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return { x, y, w, h };
  }
  return { ...POSICION_FECHA_ESCANEO };
}

function guardarPosicion(doc, pos) {
  const r = (n) => Math.round(n * 10000) / 10000;
  doc.setKeywords([`${CLAVE_POSICION}${r(pos.x)}|${r(pos.y)}|${r(pos.w)}|${r(pos.h)}`]);
}

/** Escribe la fecha sobre el escaneo; con `marcar`, el recuadro en rojo para la vista previa. */
async function sellarFecha(doc, texto, { marcar = false } = {}) {
  const page = doc.getPages()[0];
  const pos = posicionDe(doc);
  const box = { x: pos.x * page.getWidth(), y: pos.y * page.getHeight(), w: pos.w * page.getWidth(), h: pos.h * page.getHeight() };
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({
    x: box.x, y: box.y, width: box.w, height: box.h, color: rgb(1, 1, 1),
    ...(marcar ? { borderColor: rgb(0.85, 0.1, 0.1), borderWidth: 1 } : {}),
  });
  const size = Math.min(box.h * 0.68, 14);
  page.drawText(texto, { x: box.x + (box.w - font.widthOfTextAtSize(texto, size)) / 2, y: box.y + (box.h - size * 0.72) / 2, size, font, color: rgb(0, 0, 0) });
}

/**
 * Comprueba la plantilla y la devuelve como Raúl la subió, solo sin acciones
 * embebidas. No exige ni borra contenido (decisión de Raúl, 2026-10-21 hora
 * CR). A un escaneo le asegura una posición para la fecha.
 */
export async function validarPlantillaPalig(bytes) {
  const { doc, tipo } = await loadTemplate(bytes);
  if (tipo === "escaneada") guardarPosicion(doc, posicionDe(doc));
  return Buffer.from(await doc.save());
}

/** "editable" o "escaneada". */
export async function tipoDePlantillaPalig(bytes) {
  return (await loadTemplate(bytes)).tipo;
}

async function setText(doc, form, name, value) {
  const field = form.getTextField(name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const text = String(value || "").trim();
  const rect = field.acroField.getWidgets()[0].getRectangle();
  let size = 10;
  try {
    while (size > 6 && font.widthOfTextAtSize(text, size) > rect.width - 6) size -= 0.5;
    if (font.widthOfTextAtSize(text, size) > rect.width - 6) throw new Error();
    field.setText(text);
    field.setFontSize(size);
    if (text && [F.serviceDate, F.birthDate].includes(name)) {
      for (const widget of field.acroField.getWidgets()) widget.getOrCreateAppearanceCharacteristics().setBackgroundColor([1, 1, 1]);
    }
    field.updateAppearances(font);
  } catch { throw new PaligError("Un nombre no cabe en el formulario PALIG o contiene caracteres no compatibles. Revise los datos del perfil."); }
}

/**
 * Prepara la plantilla que sube el profesional para un paciente.
 *
 * En la editable completa, SOLO si están vacíos, los datos del profesional que
 * se repiten en todos sus formularios: nombre, número de colegiado y teléfono
 * de la empresa (pedido de Raúl, 2026-10-21 hora CR). Lo que él escribió se
 * respeta. La escaneada se guarda tal cual: lo suyo ya está en la imagen.
 *
 * @param {{nombre?: string, colegiado?: string, telefono?: string}} profesional
 */
export async function prepararPlantillaPalig(bytes, profesional = {}) {
  const { doc, form, tipo } = await loadTemplate(bytes);
  if (tipo === "escaneada") {
    guardarPosicion(doc, posicionDe(doc));
  } else {
    for (const [campo, valor] of [[F.professionalName, profesional.nombre], [F.professionalLicense, profesional.colegiado], [F.professionalPhone, profesional.telefono]]) {
      if (valor && !form.getTextField(campo).getText()?.trim()) await setText(doc, form, campo, valor);
    }
  }
  return { bytes: Buffer.from(await doc.save()), tipo };
}

/**
 * Mueve el recuadro de la fecha de una plantilla escaneada.
 * `dx`/`dy` en puntos (positivo: derecha/arriba).
 */
export async function moverFechaPalig(bytes, { dx = 0, dy = 0 } = {}) {
  const { doc, tipo } = await loadTemplate(bytes);
  if (tipo !== "escaneada") throw new PaligError("Solo se ajusta la fecha de una plantilla escaneada: en la editable va en su campo.");
  const page = doc.getPages()[0];
  const pos = posicionDe(doc);
  const limitar = (n, max) => Math.min(Math.max(n, 0), max);
  guardarPosicion(doc, {
    ...pos,
    x: limitar(pos.x + Number(dx || 0) / page.getWidth(), 1 - pos.w),
    y: limitar(pos.y + Number(dy || 0) / page.getHeight(), 1 - pos.h),
  });
  return Buffer.from(await doc.save());
}

/** Vista previa: la plantilla con una fecha de ejemplo, marcada en rojo si es escaneada. */
export async function muestraFechaPalig(bytes, date = new Date()) {
  const { doc, form, tipo } = await loadTemplate(bytes);
  if (tipo === "escaneada") await sellarFecha(doc, fechaPalig(date), { marcar: true });
  else await setText(doc, form, F.serviceDate, fechaPalig(date));
  return Buffer.from(await doc.save());
}

/**
 * Dos usos:
 *  - Sin `final`: el formulario en blanco precargado con los datos del perfil,
 *    para que Raúl arme la plantilla.
 *  - Con `final`: el documento que se entrega. Sobre la plantilla de Raúl solo
 *    se escribe la fecha de atención —la del pago— y se congela; todo lo demás
 *    queda como él lo dejó.
 */
export async function completarPalig(bytes, { patient, professional, date = null, final = false }) {
  const { doc, form, tipo } = await loadTemplate(bytes);
  if (final) {
    if (tipo === "escaneada") {
      if (date) await sellarFecha(doc, fechaPalig(date));
    } else {
      await setText(doc, form, F.serviceDate, date ? fechaPalig(date) : "");
      form.flatten();
    }
    return Buffer.from(await doc.save());
  }
  if (tipo !== "editable") throw new PaligError("El formulario en blanco tiene que ser el editable.");
  await setText(doc, form, F.patientName, patient.name);
  await setText(doc, form, F.professionalName, professional.user.name);
  await setText(doc, form, F.serviceDate, date ? fechaPalig(date) : "");
  // La fecha de nacimiento es un día de calendario, almacenado a medianoche UTC.
  if (patient.birthDate) {
    const [year, month, day] = new Date(patient.birthDate).toISOString().slice(0, 10).split("-");
    await setText(doc, form, F.birthDate, `${day}/${month}/${year.slice(-2)}`);
  }
  await setText(doc, form, F.specialty, professional.specialty);
  await setText(doc, form, F.professionalLicense, professional.licenseNumber);
  await setText(doc, form, F.professionalPhone, professional.telefonoEmpresa || professional.user.phone);
  form.getTextField(F.signatureDate).setText("");
  return Buffer.from(await doc.save());
}

/**
 * Representación imprimible de una factura ya aceptada; nunca un borrador
 * fiscal. Es la misma que va adjunta al correo de la factura (fe/factura-pdf):
 * acá solo se traduce el rechazo a un mensaje para el operador del piloto.
 */
export async function facturaPaligPdf(invoice, issuer) {
  if (!facturaImprimible(invoice)) {
    throw new PaligError("La factura todavía no ha sido aceptada por Hacienda. Use «Actualizar estado»; no registre otro pago.", 409);
  }
  return facturaPdf(invoice, issuer);
}
