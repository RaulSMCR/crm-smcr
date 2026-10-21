// Reglas del piloto PALIG. No contiene datos clínicos ni presupone que subir
// un comprobante bancario equivale a haber confirmado el ingreso.
export const PALIG_PROFESSIONAL_SLUG = "raul-olmedo";
export const PALIG_TEMPLATE_VERSION = "palig-cr-reclamo-2023";

export function esPalig(nombre) {
  return /\bpalig\b|pan[\s-]*american(?:\s+life)?/i.test(String(nombre || ""));
}

export function fechaCostaRica(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function validarAtencionPalig(cita, { monto, atencionConfirmada, pagoConfirmado, ahora = new Date(), fechaPago = ahora } = {}) {
  const fail = (message, code) => ({ ok: false, status: 409, message, code });
  if (!cita || cita.professional?.slug !== PALIG_PROFESSIONAL_SLUG) {
    return fail("El piloto PALIG está disponible únicamente para atenciones de Raúl Olmedo.", "PALIG_PROFESIONAL");
  }
  if (!esPalig(cita.patient?.insuranceName)) return fail("El paciente no tiene PALIG registrado en su perfil.", "PALIG_ASEGURADORA");
  if (!cita.patient?.insuranceTemplateUrl || cita.patient.insuranceTemplateProId !== cita.professionalId) {
    return fail("Primero debe guardarse la plantilla PALIG que Raúl preparó para este paciente.", "PALIG_PLANTILLA");
  }
  if (!atencionConfirmada || !pagoConfirmado) {
    return fail("Confirme que la atención se realizó y que el pago fue recibido.", "PALIG_CONFIRMACION");
  }
  if (!["PENDING", "CONFIRMED", "COMPLETED"].includes(cita.status)) {
    return fail("No se puede generar un reclamo por una cita cancelada o una inasistencia.", "PALIG_ESTADO_CITA");
  }
  if (!fechaCostaRica(cita.date) || new Date(cita.date) > ahora) {
    return fail("La atención debe haber ocurrido antes de generar los documentos.", "PALIG_FECHA_FUTURA");
  }
  if (!fechaCostaRica(fechaPago) || new Date(fechaPago) > ahora || fechaCostaRica(fechaPago) !== fechaCostaRica(ahora) || fechaCostaRica(cita.date) !== fechaCostaRica(fechaPago)) {
    return fail("El pago, la atención y la emisión deben ser del mismo día en Costa Rica. No se cambian fechas de citas anteriores.", "PALIG_FECHAS_DISTINTAS");
  }
  if (cita.paymentStatus !== "UNPAID") {
    return fail("Esta atención ya tiene un pago registrado. Revíselo antes de generar otra factura.", "PALIG_PAGO_EXISTENTE");
  }
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) return fail("Indique un monto recibido mayor a cero.", "PALIG_MONTO");
  return { ok: true };
}
