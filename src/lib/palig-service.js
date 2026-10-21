import { randomUUID } from "node:crypto";
import { registrarPagoManual } from "@/lib/pagos-manuales";
import { PALIG_PROFESSIONAL_SLUG, validarAtencionPalig } from "@/lib/palig-policy";
import { completarPalig, validarPlantillaPalig, PaligError } from "@/lib/palig-pdf";
import { descargarPlantillaPalig, guardarPalig, leerArchivoPalig } from "@/lib/palig-storage";

export const PALIG_CLAIM_SELECT = {
  id: true, appointmentId: true, invoiceId: true, professionalId: true, patientId: true,
  generatedFormUrl: true, paymentProofUrl: true, templateSnapshotUrl: true, status: true,
  invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, feStatus: true, feNumber: true, feXml: true, status: true, total: true } },
};

export function resumenPalig(claim) {
  return {
    id: claim.id, invoiceId: claim.invoiceId, invoiceNumber: claim.invoice?.invoiceNumber,
    date: claim.invoice?.invoiceDate, amount: Number(claim.invoice?.total || 0), status: claim.status,
    feStatus: claim.invoice?.feStatus,
    invoiceReady: claim.invoice?.feStatus === "ACCEPTED" && Boolean(claim.invoice?.feNumber && claim.invoice?.feXml) && ["PAID", "OPEN"].includes(claim.invoice?.status),
  };
}

export async function generarAtencionPalig(db, { appointmentId, monto, confirmado, proof, userId }) {
  if (typeof appointmentId !== "string" || !appointmentId.trim() || appointmentId.length > 100) throw new PaligError("Seleccione una cita.");
  if (!Number.isFinite(monto) || monto <= 0 || monto > 99999999.99 || Math.abs(monto * 100 - Math.round(monto * 100)) > 0.0001) throw new PaligError("Indique el monto recibido con un máximo de dos decimales.");
  if (confirmado !== true) throw new PaligError("Confirme la atención y el pago recibido hoy antes de emitir.");
  const cita = await db.appointment.findUnique({ where: { id: appointmentId }, select: {
    id: true, patientId: true, professionalId: true, date: true, status: true, paymentStatus: true,
    patient: { select: { name: true, insuranceName: true, insuranceTemplateUrl: true, insuranceTemplateProId: true } },
    professional: { select: { slug: true, user: { select: { name: true } } } },
  } });
  if (!cita || cita.professional?.slug !== PALIG_PROFESSIONAL_SLUG) throw new PaligError("Cita no disponible para el piloto.", 404);
  const previous = await db.insuranceClaim.findUnique({ where: { appointmentId }, select: PALIG_CLAIM_SELECT });
  if (previous) {
    if (previous.invoiceId && previous.generatedFormUrl) return previous;
    throw new PaligError("La cita ya tiene un trámite de seguro. Revíselo antes de crear otro.", 409);
  }
  const fechaPago = new Date();
  const valid = validarAtencionPalig(cita, { monto, fechaPago, atencionConfirmada: true, pagoConfirmado: true });
  if (!valid.ok) throw new PaligError(valid.message, valid.status);
  const comprobante = await leerArchivoPalig(proof, { proof: true });
  const original = await descargarPlantillaPalig(cita.patient.insuranceTemplateUrl, cita.patientId);
  const template = await validarPlantillaPalig(original);
  const generated = await completarPalig(template, { patient: cita.patient, professional: cita.professional, date: fechaPago, final: true });

  // Las copias quedan listas ANTES de registrar el ingreso. Una caída de Storage
  // nunca puede dejar un pago emitido sin su formulario. No sobrescribir archivos.
  const claimId = randomUUID();
  const base = `${claimId}/palig`;
  const templateSnapshotUrl = await guardarPalig("insurance-signed-forms", `${base}/template.pdf`, original);
  const generatedFormUrl = await guardarPalig("insurance-signed-forms", `${base}/form.pdf`, generated);
  const paymentProofUrl = await guardarPalig("insurance-signed-forms", `${base}/proof.${comprobante.extension}`, comprobante.bytes, comprobante.mime);
  let result;
  try {
    result = await registrarPagoManual(db, {
      appointmentId, monto, cuenta: "SINPE_MOVIL", tipo: "FULL_100", fechaPago, registradoPor: userId,
      palig: { claimId, templateSnapshotUrl, generatedFormUrl, paymentProofUrl, sourceTemplateUrl: cita.patient.insuranceTemplateUrl, patientName: cita.patient.name, professionalName: cita.professional.user.name, atencionConfirmada: true, pagoConfirmado: true },
    });
  } catch (error) {
    if (["P2002", "P2034"].includes(error?.code)) {
      const concurrent = await db.insuranceClaim.findUnique({ where: { appointmentId }, select: PALIG_CLAIM_SELECT });
      if (concurrent?.invoiceId && concurrent.generatedFormUrl) return concurrent;
      throw new PaligError("Otra operación está registrando la misma cita. Actualice la pantalla antes de reintentar.", 409);
    }
    throw error;
  }
  if (!result.ok) throw new PaligError(result.message, result.status);
  return db.insuranceClaim.findUnique({ where: { id: claimId }, select: PALIG_CLAIM_SELECT });
}
