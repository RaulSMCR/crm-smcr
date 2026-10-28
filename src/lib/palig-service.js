import { randomUUID } from "node:crypto";
import { registrarPagoManual } from "@/lib/pagos-manuales";
import { PALIG_PROFESSIONAL_SLUG, fechaCostaRica, validarPagoPalig } from "@/lib/palig-policy";
import { completarPalig, validarPlantillaPalig, PaligError } from "@/lib/palig-pdf";
import { descargarPlantillaPalig, guardarPalig, leerArchivoPalig } from "@/lib/palig-storage";

export const PALIG_CLAIM_SELECT = {
  id: true, appointmentId: true, invoiceId: true, professionalId: true, patientId: true,
  generatedFormUrl: true, paymentProofUrl: true, templateSnapshotUrl: true, status: true,
  signedFormUploadedAt: true, emailSentAt: true, firmaVersion: true, firmadoAt: true,
  invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, feStatus: true, feNumber: true, feXml: true, status: true, total: true } },
};

export function resumenPalig(claim) {
  return {
    id: claim.id, invoiceId: claim.invoiceId, invoiceNumber: claim.invoice?.invoiceNumber,
    date: claim.invoice?.invoiceDate, amount: Number(claim.invoice?.total || 0), status: claim.status,
    feStatus: claim.invoice?.feStatus,
    signed: Boolean(claim.signedFormUploadedAt), emailSent: Boolean(claim.emailSentAt),
    // Firmado desde el panel y todavía sin enviar: se puede revisar y reenviar.
    firmadoEnPanel: Boolean(claim.firmadoAt), firmaVersion: claim.firmaVersion ?? null,
    invoiceReady: claim.invoice?.feStatus === "ACCEPTED" && Boolean(claim.invoice?.feNumber && claim.invoice?.feXml) && ["PAID", "OPEN"].includes(claim.invoice?.status),
  };
}

/** Inicio y fin del día tico de un instante. */
function diaCR(fecha) {
  const ymd = fechaCostaRica(fecha);
  const desde = new Date(`${ymd}T00:00:00-06:00`);
  return { gte: desde, lt: new Date(desde.getTime() + 24 * 3600_000) };
}

/**
 * Servicio de la factura cuando el pago no se asocia a una sesión: el de la
 * última sesión del paciente con Raúl, o el primero de Raúl que se puede
 * facturar. De ahí salen el CABYS y el impuesto.
 */
async function servicioParaFacturar(db, patientId, professionalId) {
  const ultima = await db.appointment.findFirst({
    where: { patientId, professionalId, service: { cabysCode: { not: null }, taxId: { not: null } } },
    orderBy: { date: "desc" },
    select: { serviceId: true },
  });
  if (ultima?.serviceId) return ultima.serviceId;
  const asignacion = await db.serviceAssignment.findFirst({
    where: { professionalId, status: "APPROVED", service: { isActive: true, cabysCode: { not: null }, taxId: { not: null } } },
    select: { serviceId: true },
  });
  return asignacion?.serviceId || null;
}

/** Prepara y guarda las tres copias privadas del trámite. Nada se sobrescribe. */
async function prepararDocumentos(patient, proof, fechaDeAtencion) {
  const comprobante = await leerArchivoPalig(proof, { proof: true });
  const original = await descargarPlantillaPalig(patient.insuranceTemplateUrl, patient.id);
  const template = await validarPlantillaPalig(original);
  const generated = await completarPalig(template, { date: fechaDeAtencion, final: true });
  const claimId = randomUUID();
  const base = `${claimId}/palig`;
  return {
    claimId,
    templateSnapshotUrl: await guardarPalig("insurance-signed-forms", `${base}/template.pdf`, original),
    generatedFormUrl: await guardarPalig("insurance-signed-forms", `${base}/form.pdf`, generated),
    paymentProofUrl: await guardarPalig("insurance-signed-forms", `${base}/proof.${comprobante.extension}`, comprobante.bytes, comprobante.mime),
  };
}

/**
 * Formulario PALIG para un pago que YA se facturó (por ejemplo, desde pagos
 * manuales antes de tener la plantilla). No emite otra factura: crea el trámite
 * sobre la existente y la «fecha de atención» es la fecha de pago de esa factura.
 */
export async function generarFormularioDeFacturaPalig(db, { patientId, invoiceId, proof }) {
  if (typeof invoiceId !== "string" || !invoiceId.trim() || invoiceId.length > 100) throw new PaligError("Seleccione la factura.");
  const professional = await db.professionalProfile.findUnique({ where: { slug: PALIG_PROFESSIONAL_SLUG }, select: { id: true } });
  const patient = await db.user.findUnique({
    where: { id: String(patientId || "") },
    select: { id: true, name: true, isActive: true, insuranceName: true, insuranceTemplateUrl: true, insuranceTemplateProId: true },
  });
  if (!professional || !patient?.isActive) throw new PaligError("Paciente no disponible para el piloto.", 404);

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: {
    id: true, contactId: true, professionalId: true, invoiceType: true, status: true, paymentDate: true, total: true, appointmentId: true,
    insuranceClaim: { select: { id: true } },
  } });
  if (!invoice || invoice.contactId !== patient.id || invoice.professionalId !== professional.id || invoice.invoiceType !== "CUSTOMER_INVOICE") {
    throw new PaligError("Esa factura no es de este paciente.", 409);
  }
  if (invoice.status !== "PAID" || !invoice.paymentDate) throw new PaligError("La factura no tiene un pago registrado.", 409);
  if (invoice.insuranceClaim) throw new PaligError("Esa factura ya tiene su formulario. Búsquelo en «Documentos recientes».", 409);

  const valid = validarPagoPalig({ patient, professionalId: professional.id, monto: Number(invoice.total), confirmado: true });
  if (!valid.ok) throw new PaligError(valid.message, valid.status);

  // La sesión de la factura se vincula solo si ningún otro trámite la tiene.
  const sesionLibre = invoice.appointmentId
    && !(await db.insuranceClaim.findUnique({ where: { appointmentId: invoice.appointmentId }, select: { id: true } }));

  const docs = await prepararDocumentos(patient, proof, invoice.paymentDate);
  try {
    await db.insuranceClaim.create({ data: {
      id: docs.claimId, patientId: patient.id, professionalId: professional.id, invoiceId: invoice.id,
      appointmentId: sesionLibre ? invoice.appointmentId : null, paymentDate: invoice.paymentDate, status: "PENDING_SIGNED_FORM",
      templateSnapshotUrl: docs.templateSnapshotUrl, generatedFormUrl: docs.generatedFormUrl, paymentProofUrl: docs.paymentProofUrl,
    } });
  } catch (error) {
    // invoiceId es único: un doble envío choca acá y se devuelve el que ganó.
    if (error?.code === "P2002") {
      const existente = await db.insuranceClaim.findUnique({ where: { invoiceId: invoice.id }, select: PALIG_CLAIM_SELECT });
      if (existente) return existente;
    }
    throw error;
  }
  return db.insuranceClaim.findUnique({ where: { id: docs.claimId }, select: PALIG_CLAIM_SELECT });
}

/**
 * Pago PALIG por comprobante (decisión de Raúl, 2026-10-21 hora CR).
 *
 * El eje es el comprobante SINPE: el día en que se registra es el de la factura
 * y el de la «fecha de atención» del formulario. La plantilla que preparó Raúl
 * se entrega tal cual, con esa única fecha escrita. La sesión es opcional: si se
 * elige una, el pago la deja pagada; si no, la factura sale igual.
 *
 * Las copias del formulario, la plantilla y el comprobante se guardan ANTES de
 * registrar el ingreso: una caída de Storage nunca deja un pago emitido sin su
 * formulario. No se sobrescriben archivos.
 */
export async function generarPagoPalig(db, { patientId, appointmentId = null, monto, confirmado, proof, userId, referencia = null }) {
  if (typeof patientId !== "string" || !patientId.trim() || patientId.length > 100) throw new PaligError("Seleccione el paciente.");
  if (appointmentId !== null && (typeof appointmentId !== "string" || appointmentId.length > 100)) throw new PaligError("La sesión elegida no es válida.");
  if (!Number.isFinite(monto) || monto <= 0 || monto > 99999999.99 || Math.abs(monto * 100 - Math.round(monto * 100)) > 0.0001) throw new PaligError("Indique el monto recibido con un máximo de dos decimales.");
  if (confirmado !== true) throw new PaligError("Confirme que recibió hoy este pago por SINPE Móvil.");
  // La referencia del comprobante queda en las notas de la factura; solo cifras,
  // letras y guiones, que es lo que traen los bancos.
  const ref = String(referencia || "").replace(/[^0-9A-Za-z-]/g, "").slice(0, 40) || undefined;

  const professional = await db.professionalProfile.findUnique({
    where: { slug: PALIG_PROFESSIONAL_SLUG },
    select: { id: true, slug: true, user: { select: { name: true } } },
  });
  const patient = await db.user.findUnique({
    where: { id: patientId },
    select: { id: true, name: true, isActive: true, insuranceName: true, insuranceTemplateUrl: true, insuranceTemplateProId: true },
  });
  if (!professional || !patient?.isActive) throw new PaligError("Paciente no disponible para el piloto.", 404);

  const cita = appointmentId
    ? await db.appointment.findUnique({ where: { id: appointmentId }, select: {
        id: true, patientId: true, professionalId: true, date: true, status: true, paymentStatus: true,
        professional: { select: { slug: true } },
      } })
    : null;
  if (appointmentId && !cita) throw new PaligError("La sesión elegida no existe.", 404);

  // Reenvío del mismo pago (doble clic, conexión caída): no se emite dos veces.
  const fechaPago = new Date();
  const previo = cita
    ? await db.insuranceClaim.findUnique({ where: { appointmentId: cita.id }, select: PALIG_CLAIM_SELECT })
    : await db.insuranceClaim.findFirst({ where: { patientId, professionalId: professional.id, paymentDate: diaCR(fechaPago) }, select: PALIG_CLAIM_SELECT });
  if (previo) {
    if (cita && previo.invoiceId && previo.generatedFormUrl) return previo;
    throw new PaligError(cita
      ? "La sesión ya tiene un trámite de seguro. Revíselo antes de crear otro."
      : "Ya hay un pago PALIG registrado hoy para este paciente. Revíselo en «Documentos recientes» antes de registrar otro.", 409);
  }

  const valid = validarPagoPalig({ patient, professionalId: professional.id, cita, monto, confirmado, ahora: fechaPago });
  if (!valid.ok) throw new PaligError(valid.message, valid.status);

  const serviceId = cita ? null : await servicioParaFacturar(db, patientId, professional.id);
  if (!cita && !serviceId) throw new PaligError("Raúl no tiene un servicio con CABYS para facturar este pago.", 409);

  const { claimId, templateSnapshotUrl, generatedFormUrl, paymentProofUrl } = await prepararDocumentos(patient, proof, fechaPago);
  const palig = {
    claimId, templateSnapshotUrl, generatedFormUrl, paymentProofUrl,
    sourceTemplateUrl: patient.insuranceTemplateUrl, patientName: patient.name, professionalName: professional.user.name,
    pagoConfirmado: true,
  };

  let result;
  try {
    result = await registrarPagoManual(db, cita
      ? { appointmentId: cita.id, monto, cuenta: "SINPE_MOVIL", tipo: "FULL_100", fechaPago, referencia: ref, registradoPor: userId, palig }
      : {
          contactId: patient.id, serviceId, monto, cuenta: "SINPE_MOVIL", fechaPago, referencia: ref, registradoPor: userId, palig,
          descripcion: `Atención del ${fechaCostaRica(fechaPago).split("-").reverse().join("/")}`,
        });
  } catch (error) {
    if (["P2002", "P2034"].includes(error?.code)) {
      const concurrente = cita
        ? await db.insuranceClaim.findUnique({ where: { appointmentId: cita.id }, select: PALIG_CLAIM_SELECT })
        : await db.insuranceClaim.findFirst({ where: { patientId, professionalId: professional.id, paymentDate: diaCR(fechaPago) }, select: PALIG_CLAIM_SELECT });
      if (concurrente?.invoiceId && concurrente.generatedFormUrl) return concurrente;
      throw new PaligError("Otra operación está registrando el mismo pago. Actualice la pantalla antes de reintentar.", 409);
    }
    throw error;
  }
  if (!result.ok) throw new PaligError(result.message, result.status);
  return db.insuranceClaim.findUnique({ where: { id: claimId }, select: PALIG_CLAIM_SELECT });
}
