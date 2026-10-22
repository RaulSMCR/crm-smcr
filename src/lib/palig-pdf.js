import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
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

async function loadTemplate(bytes) {
  let doc;
  try { doc = await PDFDocument.load(bytes); } catch { throw new PaligError("El PDF no se puede leer o está protegido con contraseña."); }
  const page = doc.getPages()[0];
  if (doc.getPageCount() !== 1 || Math.abs(page.getWidth() - 612) > 1 || Math.abs(page.getHeight() - 1008) > 1) {
    throw new PaligError("Use el formulario PALIG editable disponible en esta pantalla, conservando su formato.");
  }
  const form = doc.getForm();
  if (form.hasXFA()) throw new PaligError("Use el formulario PALIG editable disponible en esta pantalla.");
  try {
    for (const name of Object.values(F)) form.getTextField(name);
    // Identificadores comunes como Text9 no bastan para reconocer un formulario.
    for (const [name, x, y] of [[F.patientName, 29.4751, 783.09], [F.serviceDate, 141.16, 612.405], [F.professionalName, 29.3481, 188.112]]) {
      const rect = form.getTextField(name).acroField.getWidgets()[0].getRectangle();
      if (Math.abs(rect.x - x) > 2 || Math.abs(rect.y - y) > 2) throw new Error();
    }
  } catch { throw new PaligError("La plantilla no conserva los campos editables del formulario PALIG. Guárdela como PDF, sin imprimirla ni escanearla."); }
  // Eliminar acciones del formulario y del documento antes de generar copias.
  doc.catalog.delete(PDFName.of("OpenAction"));
  doc.catalog.delete(PDFName.of("AA"));
  doc.catalog.delete(PDFName.of("Names"));
  page.node.delete(PDFName.of("AA"));
  for (const field of form.getFields()) {
    field.acroField.dict.delete(PDFName.of("AA"));
    for (const widget of field.acroField.getWidgets()) {
      widget.dict.delete(PDFName.of("AA"));
      widget.dict.delete(PDFName.of("A"));
    }
  }
  return { doc, form };
}

/**
 * Comprueba que la plantilla sea el formulario PALIG editable y la devuelve tal
 * como Raúl la subió, solo sin acciones embebidas.
 *
 * No exige ni borra ningún contenido: lo que Raúl escribió —datos del paciente,
 * clínicos, fecha de firma— es lo que se entrega (decisión de Raúl, 2026-10-21
 * hora CR). La única casilla que el sistema escribe es la fecha de atención, al
 * generar cada formulario (ver completarPalig con `final`).
 */
export async function validarPlantillaPalig(bytes) {
  const { doc } = await loadTemplate(bytes);
  return Buffer.from(await doc.save());
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
 * Dos usos:
 *  - Sin `final`: el formulario en blanco precargado con los datos del perfil,
 *    para que Raúl arme la plantilla.
 *  - Con `final`: el documento que se entrega. Sobre la plantilla de Raúl solo
 *    se escribe la fecha de atención —la del pago— y se congela; todo lo demás
 *    queda como él lo dejó.
 */
export async function completarPalig(bytes, { patient, professional, date = null, final = false }) {
  const { doc, form } = await loadTemplate(bytes);
  if (final) {
    await setText(doc, form, F.serviceDate, date ? fechaPalig(date) : "");
    form.flatten();
    return Buffer.from(await doc.save());
  }
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
  await setText(doc, form, F.professionalPhone, professional.user.phone);
  form.getTextField(F.signatureDate).setText("");
  return Buffer.from(await doc.save());
}

/** Representación imprimible de una factura ya aceptada; nunca un borrador fiscal. */
export async function facturaPaligPdf(invoice, issuer) {
  if (invoice.feStatus !== "ACCEPTED" || !invoice.feXml || !invoice.feNumber || !["PAID", "OPEN"].includes(invoice.status)) {
    throw new PaligError("La factura todavía no ha sido aceptada por Hacienda. Use «Actualizar estado»; no registre otro pago.", 409);
  }
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page, y;
  const newPage = () => { page = doc.addPage([612, 792]); y = 740; };
  newPage();
  const write = (text, size = 11) => {
    const words = String(text || "").replace(/\s+/g, " ").split(" ");
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > 510 && line) { lineOut(line, size); line = word; } else line = next;
    }
    lineOut(line, size);
  };
  const lineOut = (line, size) => {
    if (y < 50) newPage();
    page.drawText(line, { x: 48, y, size, font, color: rgb(0.1, 0.16, 0.2) }); y -= size + 9;
  };
  const money = (value) => `CRC ${Number(value).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (invoice.feAmbiente !== "01") write("COMPROBANTE DE PRUEBAS - SIN VALIDEZ TRIBUTARIA", 13);
  write("Factura electrónica", 22);
  write(issuer.nombre, 14);
  write(`Identificación: ${issuer.identificacion}`);
  write(issuer.correo);
  write(`Consecutivo: ${invoice.feNumber}`);
  write(`Clave: ${invoice.feClave}`, 8);
  write(`Fecha de emisión y pago: ${fechaPalig(invoice.invoiceDate)}`);
  write(`Cliente: ${invoice.contactName}`);
  write(`Identificación: ${invoice.contactIdNumber}`);
  write("Medio de pago: SINPE Móvil");
  y -= 12;
  for (const line of invoice.lines) {
    write(line.productName, 12);
    if (line.description) write(line.description);
    write(`Cantidad: ${line.quantity} | Base: ${money(line.lineSubtotal)} | Impuesto: ${money(line.taxAmount)} | Total: ${money(line.lineTotal)}`);
  }
  y -= 12;
  write(`Subtotal: ${money(invoice.subtotal)}`);
  write(`Impuestos: ${money(invoice.taxAmount)}`);
  write(`Total pagado: ${money(invoice.total)}`, 15);
  write("Representación del comprobante electrónico. Conserve también el XML aceptado.", 9);
  return Buffer.from(await doc.save());
}
