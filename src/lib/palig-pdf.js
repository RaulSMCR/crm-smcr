import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import { facturaImprimible, facturaPdf } from "@/lib/fe/factura-pdf";
import {
  PALIG_CHECKBOXES,
  PALIG_FIELDS as F,
  PALIG_PATIENT_CHECKBOX_GROUPS,
  PALIG_PATIENT_TEXT_FIELDS,
  PALIG_PROFESSIONAL_CHECKBOX_GROUPS,
  PALIG_PROFESSIONAL_TEXT_FIELDS,
} from "@/lib/palig-fields";
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

/**
 * Recuadro de la firma de Raúl en un escaneo, con la misma convención que la
 * fecha. Valor de base medido sobre el escaneo de Javier: «Firma del Médico»,
 * con el mismo desborde arriba y abajo que en el editable (Raúl firma grande).
 * Se ajusta con flechas al firmar y queda guardado en la plantilla.
 */
export const POSICION_FIRMA_ESCANEO = Object.freeze({ x: 0.56, y: 0.13, w: 0.24, h: 0.065 });
const CLAVE_FIRMA = "smcr-firma-medico:";

/**
 * Casilla «Fecha:» a la derecha de «Número de teléfono», debajo de la firma: la
 * misma fecha de servicio, como en el editable (pedido de Raúl, 28-oct-2026
 * hora CR). Medida sobre el escaneo de Javier, debajo del rótulo impreso.
 */
export const POSICION_FECHA_FIRMA_ESCANEO = Object.freeze({ x: 0.895, y: 0.108, w: 0.08, h: 0.022 });
const CLAVE_FECHA_FIRMA = "smcr-fecha-firma:";

function leerPosicion(doc, clave, base) {
  const guardada = (doc.getKeywords() || "").split(/[;,]?\s+/).find((k) => k.startsWith(clave));
  if (guardada) {
    const [x, y, w, h] = guardada.slice(clave.length).split("|").map(Number);
    if ([x, y, w, h].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return { x, y, w, h };
  }
  return { ...base };
}

/** La posición de la fecha guardada en la plantilla escaneada (o la de base). */
function posicionDe(doc) {
  return leerPosicion(doc, CLAVE_POSICION, POSICION_FECHA_ESCANEO);
}

/** La posición de la firma guardada en la plantilla escaneada (o la de base). */
function posicionFirmaDe(doc) {
  return leerPosicion(doc, CLAVE_FIRMA, POSICION_FIRMA_ESCANEO);
}

/** La posición de la fecha junto a la firma (o la de base). */
function posicionFechaFirmaDe(doc) {
  return leerPosicion(doc, CLAVE_FECHA_FIRMA, POSICION_FECHA_FIRMA_ESCANEO);
}

/** Guarda las tres posiciones; la que no se pasa queda como estaba. */
function guardarPosiciones(doc, { fecha = posicionDe(doc), firma = posicionFirmaDe(doc), fechaFirma = posicionFechaFirmaDe(doc) } = {}) {
  const r = (n) => Math.round(n * 10000) / 10000;
  const texto = (clave, pos) => `${clave}${r(pos.x)}|${r(pos.y)}|${r(pos.w)}|${r(pos.h)}`;
  doc.setKeywords([texto(CLAVE_POSICION, fecha), texto(CLAVE_FIRMA, firma), texto(CLAVE_FECHA_FIRMA, fechaFirma)]);
}

/** Corre un recuadro `dx`/`dy` puntos (positivo: derecha/arriba) sin sacarlo de la página. */
function desplazar(pos, page, dx, dy) {
  const limitar = (n, max) => Math.min(Math.max(n, 0), max);
  return {
    ...pos,
    x: limitar(pos.x + Number(dx || 0) / page.getWidth(), 1 - pos.w),
    y: limitar(pos.y + Number(dy || 0) / page.getHeight(), 1 - pos.h),
  };
}

/**
 * Escribe la fecha sobre el escaneo; con `marcar`, el recuadro en rojo para la
 * vista previa. Por defecto en «Fecha de servicio»; `pos` elige otra casilla.
 */
async function sellarFecha(doc, texto, { marcar = false, pos = posicionDe(doc) } = {}) {
  const page = doc.getPages()[0];
  const box = { x: pos.x * page.getWidth(), y: pos.y * page.getHeight(), w: pos.w * page.getWidth(), h: pos.h * page.getHeight() };
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({
    x: box.x, y: box.y, width: box.w, height: box.h, color: rgb(1, 1, 1),
    ...(marcar ? { borderColor: rgb(0.85, 0.1, 0.1), borderWidth: 1 } : {}),
  });
  // Que entre también en una casilla angosta como la de junto a la firma.
  const size = Math.min(box.h * 0.68, 14, (box.w - 2) / font.widthOfTextAtSize(texto, 1));
  page.drawText(texto, { x: box.x + (box.w - font.widthOfTextAtSize(texto, size)) / 2, y: box.y + (box.h - size * 0.72) / 2, size, font, color: rgb(0, 0, 0) });
}

/**
 * Comprueba la plantilla y la devuelve como Raúl la subió, solo sin acciones
 * embebidas. No exige ni borra contenido (decisión de Raúl, 2026-10-21 hora
 * CR). A un escaneo le asegura una posición para la fecha.
 */
export async function validarPlantillaPalig(bytes) {
  const { doc, tipo } = await loadTemplate(bytes);
  if (tipo === "escaneada") guardarPosiciones(doc);
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
  let cabe;
  try {
    while (size > 6 && font.widthOfTextAtSize(text, size) > rect.width - 6) size -= 0.5;
    cabe = font.widthOfTextAtSize(text, size) <= rect.width - 6;
  } catch { cabe = false; }
  if (!cabe) throw new PaligError("Un nombre no cabe en el formulario PALIG o contiene caracteres no compatibles. Revise los datos del perfil.");
  // pdf-lib solo fija el tamaño si la apariencia por defecto trae la fuente
  // como «/Nombre tamaño Tf». Algunos programas la guardan con la barra en
  // octal («\057Helv 12 Tf»), que es PDF válido pero pdf-lib no lo lee. Pasó
  // con una plantilla de Alejandro, 27-oct-2026 hora CR, en la fecha de servicio.
  if (!/\/\S+\s+[\d.]+\s+Tf/.test(field.acroField.getDefaultAppearance() || "")) field.acroField.setDefaultAppearance("/Helv 0 Tf 0 g");
  try {
    field.setText(text);
    field.setFontSize(size);
    // Fondo blanco para tapar el «dd/mm/aa» que el formulario trae impreso.
    if (text && [F.serviceDate, F.birthDate, F.signatureDate].includes(name)) {
      for (const widget of field.acroField.getWidgets()) {
        // La casilla de la fecha junto a la firma pisa el marco: sin achicarla, el blanco lo borra.
        if (name === F.signatureDate) widget.setRectangle({ x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 });
        widget.getOrCreateAppearanceCharacteristics().setBackgroundColor([1, 1, 1]);
      }
    }
    field.updateAppearances(font);
  } catch { throw new PaligError("La plantilla PALIG tiene un campo que no se puede completar. Baje el formulario en blanco de esta pantalla y vuelva a armarla."); }
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
    guardarPosiciones(doc);
  } else {
    for (const [campo, valor] of [[F.professionalName, profesional.nombre], [F.professionalLicense, profesional.colegiado], [F.professionalPhone, profesional.telefono]]) {
      if (valor && !form.getTextField(campo).getText()?.trim()) await setText(doc, form, campo, valor);
    }
  }
  return { bytes: Buffer.from(await doc.save()), tipo };
}

/**
 * Mueve un recuadro de una plantilla escaneada: `cual` es "fecha" (la de
 * servicio), "fechaFirma" (la de junto a la firma) o "firma". `dx`/`dy` en puntos (positivo: derecha/arriba).
 */
export async function moverFechaPalig(bytes, { dx = 0, dy = 0, cual = "fecha" } = {}) {
  const { doc, tipo } = await loadTemplate(bytes);
  if (tipo !== "escaneada") throw new PaligError("Solo se ajusta una plantilla escaneada: en la editable la fecha y la firma tienen su lugar fijo.");
  const page = doc.getPages()[0];
  if (cual === "firma") guardarPosiciones(doc, { firma: desplazar(posicionFirmaDe(doc), page, dx, dy) });
  else if (cual === "fechaFirma") guardarPosiciones(doc, { fechaFirma: desplazar(posicionFechaFirmaDe(doc), page, dx, dy) });
  else guardarPosiciones(doc, { fecha: desplazar(posicionDe(doc), page, dx, dy) });
  return Buffer.from(await doc.save());
}

/** Dónde quedó la firma en un PDF firmado (o en una plantilla) escaneado. */
export async function posicionFirmaPalig(bytes) {
  return posicionFirmaDe(await PDFDocument.load(bytes));
}

/** La posición de la firma corrida `dx`/`dy` puntos dentro de la página de `bytes`. */
export async function desplazarFirmaPalig(bytes, pos, { dx = 0, dy = 0 } = {}) {
  return desplazar(pos, (await PDFDocument.load(bytes)).getPages()[0], dx, dy);
}

/** Vista previa: la plantilla con una fecha de ejemplo; si es escaneada, las fechas en rojo y la firma en azul. */
export async function muestraFechaPalig(bytes, date = new Date()) {
  const { doc, form, tipo } = await loadTemplate(bytes);
  if (tipo === "escaneada") {
    await sellarFecha(doc, fechaPalig(date), { marcar: true });
    await sellarFecha(doc, fechaPalig(date), { marcar: true, pos: posicionFechaFirmaDe(doc) });
    // Dónde va a caer la firma de Raúl, en azul: solo en la vista previa.
    const page = doc.getPages()[0];
    const pos = posicionFirmaDe(doc);
    page.drawRectangle({
      x: pos.x * page.getWidth(), y: pos.y * page.getHeight(), width: pos.w * page.getWidth(), height: pos.h * page.getHeight(),
      borderColor: rgb(0.1, 0.3, 0.85), borderWidth: 1,
    });
  } else await fecharEditable(doc, form, fechaPalig(date));
  return Buffer.from(await doc.save());
}

/**
 * La fecha de atención va en dos lugares del editable: «Fecha de servicio» y la
 * fecha junto a la firma del profesional, abajo a la derecha. Son la misma
 * (pedido de Raúl, 27-oct-2026 hora CR).
 */
async function fecharEditable(doc, form, texto) {
  await setText(doc, form, F.serviceDate, texto);
  await setText(doc, form, F.signatureDate, texto);
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
      await fecharEditable(doc, form, date ? fechaPalig(date) : "");
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
 * Dónde va la firma en el editable (612 × 1008), en puntos, origen
 * abajo-izquierda. El recuadro «Firma del Médico» va de x 361 a 580 y de y 158
 * a 186, pero Raúl firma grande y se sale de las líneas (pedido suyo,
 * 27-oct-2026 hora CR): la firma desborda arriba y abajo del recuadro.
 */
export const RECUADRO_FIRMA = Object.freeze({ x: 392, y: 138, w: 192, h: 68 });

/**
 * Estampa la firma de Raúl (PNG transparente) en el formulario ya emitido.
 * `plantilla` es la copia que guardó el trámite: dice si salió del editable o
 * de un escaneo. En el editable va en RECUADRO_FIRMA. En un escaneo el recuadro
 * cae donde cae el papel: se usa la posición guardada en la plantilla (o la de
 * base) o la que se pase en `posicion` al correrla, y queda anotada en el PDF
 * firmado para poder correrla de nuevo. Con `fecha` (la de servicio), en un
 * escaneo también la escribe en la casilla «Fecha:» de junto a la firma, como
 * el editable; se hace al firmar para que valga también en los trámites que ya
 * estaban emitidos.
 */
export async function firmarPalig(formulario, plantilla, firmaPng, { posicion = null, fecha = null } = {}) {
  const { doc: base, tipo } = await loadTemplate(plantilla);
  let doc;
  try { doc = await PDFDocument.load(formulario); } catch { throw new PaligError("No se pudo leer el formulario emitido.", 409); }
  const page = doc.getPages()[0];
  let r = RECUADRO_FIRMA;
  if (tipo === "escaneada") {
    const pos = posicion ?? posicionFirmaDe(base);
    r = { x: pos.x * page.getWidth(), y: pos.y * page.getHeight(), w: pos.w * page.getWidth(), h: pos.h * page.getHeight() };
    guardarPosiciones(doc, { firma: pos });
    if (fecha) await sellarFecha(doc, fechaPalig(fecha), { pos: posicionFechaFirmaDe(base) });
  }
  const firma = await doc.embedPng(firmaPng);
  const escala = Math.min(r.w / firma.width, r.h / firma.height);
  const w = firma.width * escala;
  const h = firma.height * escala;
  page.drawImage(firma, { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, width: w, height: h });
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

// ─── Las dos partes del formulario ──────────────────────────────────────────
//
// Desde el 2026-11-03 (decisión de Raúl) el paciente entrega su parte una sola
// vez —la llena en línea y firma con el dedo, o sube la foto del papel firmado—
// y el profesional completa la suya en una pantalla. De ahí sale la plantilla de
// ese paciente; cada pago le pone después la fecha y la firma del profesional.
//
// El PDF es el que guarda los datos. Para poder mostrarlos de nuevo al editar
// —en una foto no hay campos que leer— viajan también en el metadato «Subject».

const CLAVE_DATOS = "smcr-datos:";

/**
 * Recuadro «Firma del paciente mayor de edad o responsable» del editable, en
 * puntos (origen abajo-izquierda): a la derecha del rótulo, entre el texto de
 * consentimiento y «(igual que en el documento de identificación)».
 */
export const RECUADRO_FIRMA_PACIENTE = Object.freeze({ x: 380, y: 619, w: 200, h: 27 });

/** El texto más largo que se acepta en una casilla del formulario. */
const LARGO_MAXIMO = 240;

function leerDatos(doc) {
  const subject = doc.getSubject() || "";
  if (!subject.startsWith(CLAVE_DATOS)) return { paciente: null, profesional: null };
  try {
    const datos = JSON.parse(subject.slice(CLAVE_DATOS.length));
    return { paciente: datos.paciente || null, profesional: datos.profesional || null };
  } catch {
    return { paciente: null, profesional: null };
  }
}

function guardarDatos(doc, datos) {
  doc.setSubject(`${CLAVE_DATOS}${JSON.stringify(datos)}`);
}

/** '2026-03-05' (lo que da un campo de fecha) → '05/03/26', como pide PALIG. Sin pasar por Date: es un día, no un instante. */
export function diaPalig(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(-2)}` : "";
}

/** Solo las claves conocidas, recortadas y sin exceder el largo de una casilla. */
function limpiar(datos = {}, claves) {
  const limpio = {};
  for (const clave of claves) {
    const valor = String(datos?.[clave] ?? "").replace(/\s+/g, " ").trim();
    if (valor.length > LARGO_MAXIMO) throw new PaligError(`Un dato es demasiado largo para el formulario (máximo ${LARGO_MAXIMO} caracteres).`);
    if (valor) limpio[clave] = valor;
  }
  return limpio;
}

/** De cada grupo de casillas, la opción elegida si es una de las del formulario. */
function limpiarCasillas(datos = {}, grupos) {
  const limpio = {};
  for (const grupo of grupos) {
    const opcion = String(datos?.[grupo] || "");
    if (opcion && PALIG_CHECKBOXES[grupo][opcion]) limpio[grupo] = opcion;
  }
  return limpio;
}

/** Texto en una casilla, con un mensaje que no culpa al perfil si no cabe. */
async function escribir(doc, form, campo, valor) {
  try {
    await setText(doc, form, campo, valor);
  } catch (error) {
    if (error instanceof PaligError) throw new PaligError("Un dato no cabe en su casilla del formulario o tiene caracteres no compatibles. Acórtelo.");
    throw error;
  }
}

function marcarGrupo(form, grupo, opcion) {
  for (const [clave, nombre] of Object.entries(PALIG_CHECKBOXES[grupo])) {
    const casilla = form.getCheckBox(nombre);
    if (clave === opcion) casilla.check(); else casilla.uncheck();
  }
}

/**
 * La parte del paciente hecha en línea: el formulario editable con sus datos y
 * su firma (PNG transparente) en el recuadro del asegurado. No se aplana: el
 * profesional completa después su parte en los mismos campos.
 *
 * @param {Buffer} enBlanco  public/forms/palig-cr-reclamo-2023.pdf
 * @param {object} datos     claves de PALIG_PATIENT_TEXT_FIELDS (fechas 'YYYY-MM-DD') y de sus grupos de casillas
 */
export async function formularioDelPaciente(enBlanco, datos, firmaPng) {
  const textos = limpiar(datos, Object.keys(PALIG_PATIENT_TEXT_FIELDS));
  const casillas = limpiarCasillas(datos, PALIG_PATIENT_CHECKBOX_GROUPS);
  for (const obligatorio of ["empresa", "poliza", "nombre"]) {
    if (!textos[obligatorio]) throw new PaligError("Complete la empresa contratante, el número de póliza y el nombre del paciente.");
  }
  if (!firmaPng?.length) throw new PaligError("Falta la firma del paciente.");

  const { doc, form, tipo } = await loadTemplate(enBlanco);
  if (tipo !== "editable") throw new PaligError("El formulario en blanco tiene que ser el editable.", 500);
  for (const [clave, campo] of Object.entries(PALIG_PATIENT_TEXT_FIELDS)) {
    const valor = clave === "nacimiento" || clave === "inicioSintomas" ? diaPalig(textos[clave]) : textos[clave];
    await escribir(doc, form, campo, valor);
  }
  for (const [grupo, opcion] of Object.entries(casillas)) marcarGrupo(form, grupo, opcion);

  let firma;
  try { firma = await doc.embedPng(firmaPng); } catch { throw new PaligError("La firma no se pudo leer. Vuelva a firmar."); }
  const r = RECUADRO_FIRMA_PACIENTE;
  const escala = Math.min(r.w / firma.width, r.h / firma.height);
  doc.getPages()[0].drawImage(firma, {
    x: r.x, y: r.y + (r.h - firma.height * escala) / 2,
    width: firma.width * escala, height: firma.height * escala,
  });

  guardarDatos(doc, { paciente: { ...textos, ...casillas, enLinea: true }, profesional: null });
  return Buffer.from(await doc.save());
}

/**
 * La parte del paciente como archivo: el PDF del formulario (editable o
 * escaneado) o la foto del papel firmado, que se convierte en un PDF de una
 * página con las proporciones de la foto.
 */
export async function formularioDelPacienteDesdeArchivo(bytes, mime) {
  if (mime === "application/pdf") return validarPlantillaPalig(bytes);
  const doc = await PDFDocument.create();
  let imagen;
  try {
    imagen = mime === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch { throw new PaligError("La foto está dañada. Vuelva a sacarla."); }
  const proporcion = imagen.height / imagen.width;
  if (proporcion < 1.3 || proporcion > 1.9) {
    throw new PaligError("La foto tiene que mostrar la hoja completa, vertical y sin bordes de más.");
  }
  const ancho = 612;
  const page = doc.addPage([ancho, ancho * proporcion]);
  page.drawImage(imagen, { x: 0, y: 0, width: ancho, height: ancho * proporcion });
  return validarPlantillaPalig(Buffer.from(await doc.save()));
}

/** Tipo y datos de cada parte, para mostrarlos al editar. */
export async function leerDatosPalig(bytes) {
  const { doc, tipo } = await loadTemplate(bytes);
  return { tipo, ...leerDatos(doc) };
}

/**
 * La plantilla de un paciente: su formulario más la parte del profesional.
 * Se arma siempre a partir del formulario del paciente, nunca sobre una
 * plantilla anterior: en una foto el texto queda dibujado y escribirlo de nuevo
 * lo duplicaría.
 *
 * Las fechas (de servicio y junto a la firma) quedan vacías: las pone cada pago.
 * Los datos clínicos son los que escribió el profesional; el sistema no los
 * deduce ni completa.
 *
 * @param {Buffer} formularioPaciente
 * @param {Buffer} enBlanco   el editable, para ubicar las casillas sobre una foto
 * @param {object} datos      claves de PALIG_PROFESSIONAL_TEXT_FIELDS y de sus grupos de casillas
 * @param {{nombre: string, especialidad?: string, colegiado?: string, telefono?: string}} profesional
 */
export async function plantillaConParteProfesional(formularioPaciente, enBlanco, datos, profesional) {
  const textos = limpiar(datos, Object.keys(PALIG_PROFESSIONAL_TEXT_FIELDS));
  const casillas = limpiarCasillas(datos, PALIG_PROFESSIONAL_CHECKBOX_GROUPS);
  if (!textos.motivo || !textos.diagnostico) throw new PaligError("Complete al menos el motivo de la consulta y el diagnóstico.");

  const fijos = [
    [F.professionalName, profesional.nombre],
    [F.specialty, profesional.especialidad],
    [F.professionalLicense, profesional.colegiado],
    [F.professionalPhone, profesional.telefono],
  ];
  const aEscribir = [...Object.entries(PALIG_PROFESSIONAL_TEXT_FIELDS).map(([clave, campo]) => [campo, textos[clave]]), ...fijos];

  const { doc, form, tipo } = await loadTemplate(formularioPaciente);
  const anteriores = leerDatos(doc);

  if (tipo === "editable") {
    for (const [campo, valor] of aEscribir) await escribir(doc, form, campo, valor);
    for (const grupo of PALIG_PROFESSIONAL_CHECKBOX_GROUPS) {
      if (casillas[grupo]) marcarGrupo(form, grupo, casillas[grupo]);
      else for (const nombre of Object.values(PALIG_CHECKBOXES[grupo])) form.getCheckBox(nombre).uncheck();
    }
    await escribir(doc, form, F.serviceDate, "");
    await escribir(doc, form, F.signatureDate, "");
  } else {
    // Sobre una foto: cada texto en el lugar proporcional de su casilla del
    // editable. El formulario es el mismo; cambia solo la escala.
    const { form: blanco } = await loadTemplate(enBlanco);
    const page = doc.getPages()[0];
    const ex = page.getWidth() / 612;
    const ey = page.getHeight() / 1008;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const [campo, valor] of aEscribir) {
      if (!valor) continue;
      const r = blanco.getTextField(campo).acroField.getWidgets()[0].getRectangle();
      const box = { x: r.x * ex, y: r.y * ey, w: r.width * ex, h: r.height * ey };
      const size = Math.max(5, Math.min(box.h * 0.7, 10, (box.w - 4) / Math.max(1, font.widthOfTextAtSize(valor, 1))));
      page.drawText(valor, { x: box.x + 2, y: box.y + (box.h - size * 0.72) / 2, size, font, color: rgb(0, 0, 0.35) });
    }
    for (const [grupo, opcion] of Object.entries(casillas)) {
      const r = blanco.getCheckBox(PALIG_CHECKBOXES[grupo][opcion]).acroField.getWidgets()[0].getRectangle();
      page.drawText("X", { x: r.x * ex + 1, y: r.y * ey + 1, size: Math.max(6, r.height * ey), font, color: rgb(0, 0, 0.35) });
    }
    guardarPosiciones(doc);
  }

  guardarDatos(doc, { paciente: anteriores.paciente, profesional: { ...textos, ...casillas } });
  return Buffer.from(await doc.save());
}
