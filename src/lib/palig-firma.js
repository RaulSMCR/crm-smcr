import { desplazarFirmaPalig, facturaPaligPdf, firmarPalig, moverFechaPalig, PaligError, posicionFirmaPalig, tipoDePlantillaPalig } from "@/lib/palig-pdf";
import { descargarDelTramite, descargarFirma, descargarPlantillaPalig, guardarPalig, nombreDePlantilla, versionesDeFirma } from "@/lib/palig-storage";
import { sendSignedClaimToPatient } from "@/lib/insurance-mail";
import { FE_EMISOR } from "@/lib/fe/config";

// Firma desde el panel (pedido de Raúl, 27-oct-2026 hora CR): un botón estampa
// su firma en el formulario emitido; se revisa y otro botón lo manda al
// paciente. La firma rota entre las versiones guardadas, una distinta cada vez.

/** La versión que sigue a `ultima`; después de la última vuelve a la primera. */
export function siguienteVersion(disponibles, ultima) {
  if (!disponibles.length) throw new PaligError("Todavía no hay firmas guardadas para firmar desde el panel.", 409);
  return disponibles.find((v) => ultima != null && v > ultima) ?? disponibles[0];
}

/** Dónde queda el PDF firmado mientras no se envía. Sale de los datos del trámite. */
export function rutaFirmado(claim) {
  if (!claim.firmadoAt) return null;
  return `insurance-signed-forms/${claim.id}/palig/firmado-${new Date(claim.firmadoAt).getTime()}.pdf`;
}

function exigirAbierto(claim) {
  if (claim.emailSentAt) throw new PaligError("Este formulario ya se envió al paciente.", 409);
  if (!["OPEN", "PAID"].includes(claim.invoice?.status)) throw new PaligError("La factura fue cancelada.", 409);
}

/** La fecha de servicio del trámite: la del pago, la misma que va arriba en el formulario. */
const fechaDeServicio = (claim) => claim.paymentDate || claim.invoice?.invoiceDate || null;

/** Guarda el PDF firmado y anota en el trámite qué versión y cuándo. */
async function guardarFirmado(db, claim, firmado, version, ahora) {
  const datos = { firmaVersion: version, firmadoAt: ahora };
  try {
    const ruta = rutaFirmado({ id: claim.id, ...datos });
    await guardarPalig("insurance-signed-forms", ruta.slice("insurance-signed-forms/".length), firmado);
  } catch { throw new PaligError("No se pudo guardar el formulario firmado. Intente de nuevo.", 503); }
  return db.insuranceClaim.update({ where: { id: claim.id }, data: datos, include: { invoice: true } });
}

/**
 * Dónde quedó la firma la vez anterior, para que firmar con otra versión no la
 * devuelva a la posición de base después de haberla corrido. Solo en escaneos.
 */
async function posicionAnterior(claim) {
  const ruta = rutaFirmado(claim);
  if (!ruta) return null;
  try { return await posicionFirmaPalig(await descargarDelTramite(ruta, claim.id)); } catch { return null; }
}

/** Estampa la siguiente versión de la firma. Se puede repetir mientras no se envíe. */
export async function firmarTramitePalig(db, claim, { ahora = new Date() } = {}) {
  exigirAbierto(claim);
  const ultima = await db.insuranceClaim.findFirst({
    where: { professionalId: claim.professionalId, firmaVersion: { not: null } },
    orderBy: { firmadoAt: "desc" }, select: { firmaVersion: true },
  });
  const version = siguienteVersion(await versionesDeFirma(), ultima?.firmaVersion);
  const [formulario, plantilla, firma] = await Promise.all([
    descargarDelTramite(claim.generatedFormUrl, claim.id),
    descargarDelTramite(claim.templateSnapshotUrl, claim.id),
    descargarFirma(version),
  ]);
  const escaneada = (await tipoDePlantillaPalig(plantilla)) === "escaneada";
  const posicion = escaneada ? await posicionAnterior(claim) : null;
  const firmado = await firmarPalig(formulario, plantilla, firma, { posicion, fecha: fechaDeServicio(claim) });
  // `escaneada` le dice a la pantalla que ofrezca correr la firma.
  return { ...(await guardarFirmado(db, claim, firmado, version, ahora)), escaneada };
}

/**
 * Corre la firma de un formulario escaneado ya firmado (las flechas de la
 * pantalla). Vuelve a estampar la misma versión, en la posición nueva, sobre el
 * formulario emitido: nunca encima del firmado anterior.
 *
 * Si se pasa `patient`, la posición también queda en su plantilla: el próximo
 * trámite de ese paciente ya sale con la firma en su lugar. Se le aplica el
 * mismo corrimiento solo si sigue siendo un escaneo del mismo tamaño; si no,
 * no se toca. Que eso falle no deshace el formulario firmado.
 */
export async function moverFirmaTramitePalig(db, claim, { dx = 0, dy = 0, patient = null, ahora = new Date() } = {}) {
  exigirAbierto(claim);
  const ruta = rutaFirmado(claim);
  if (!ruta || claim.firmaVersion == null) throw new PaligError("Primero firme el formulario.", 409);
  const [anterior, formulario, plantilla, firma] = await Promise.all([
    descargarDelTramite(ruta, claim.id),
    descargarDelTramite(claim.generatedFormUrl, claim.id),
    descargarDelTramite(claim.templateSnapshotUrl, claim.id),
    descargarFirma(claim.firmaVersion),
  ]);
  if ((await tipoDePlantillaPalig(plantilla)) !== "escaneada") {
    throw new PaligError("En el formulario editable la firma va en su lugar fijo.", 409);
  }
  const posicion = await desplazarFirmaPalig(anterior, await posicionFirmaPalig(anterior), { dx, dy });
  const firmado = await firmarPalig(formulario, plantilla, firma, { posicion, fecha: fechaDeServicio(claim) });
  const actualizado = { ...(await guardarFirmado(db, claim, firmado, claim.firmaVersion, ahora)), escaneada: true };

  if (patient?.insuranceTemplateUrl) {
    try {
      const actual = await descargarPlantillaPalig(patient.insuranceTemplateUrl, patient.id);
      const movida = await moverFechaPalig(actual, { dx, dy, cual: "firma" });
      const reference = await guardarPalig("insurance-templates", nombreDePlantilla(patient.id, "escaneada"), movida);
      await db.user.update({ where: { id: patient.id }, data: { insuranceTemplateUrl: reference } });
    } catch { console.error("[palig] SIGNATURE_POSITION_NOT_REMEMBERED"); }
  }
  return actualizado;
}

/** Manda al paciente el formulario firmado desde el panel, con la factura si ya está aceptada. */
export async function enviarFirmadoPalig(db, claim, { patient }) {
  exigirAbierto(claim);
  const ruta = rutaFirmado(claim);
  if (!ruta) throw new PaligError("Primero firme el formulario.", 409);
  const formulario = await descargarDelTramite(ruta, claim.id);
  await db.insuranceClaim.update({ where: { id: claim.id }, data: { signedFormUrl: ruta, signedFormUploadedAt: new Date(), status: "COMPLETED" } });

  // Igual que al subir el firmado a mano: facturaPaligPdf se niega a dibujar
  // una factura pendiente, y entonces el correo lo aclara.
  let factura = null;
  try { factura = { filename: `Factura-${claim.invoice.invoiceNumber}.pdf`, content: await facturaPaligPdf(claim.invoice, FE_EMISOR) }; } catch { factura = null; }
  const emailSent = await sendSignedClaimToPatient({
    patientEmail: patient.email, patientName: patient.name,
    formulario: { filename: "Formulario-reclamo-firmado.pdf", content: formulario },
    factura,
  });
  if (emailSent) await db.insuranceClaim.update({ where: { id: claim.id }, data: { emailSentAt: new Date() } });
  return { emailSent, facturaAdjunta: Boolean(factura) };
}
