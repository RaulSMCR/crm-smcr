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

/**
 * ¿Se puede registrar este pago PALIG?
 *
 * El eje es el comprobante, no la cita (decisión de Raúl, 2026-10-21 hora CR):
 * el día en que se registra el pago es el día de la factura y el de la «fecha
 * de atención» del formulario. Por eso no se compara la fecha de ninguna cita
 * con la del pago. La cita es opcional: si se elige una, solo se comprueba que
 * sea de este paciente, que ya haya ocurrido y que esté sin pagar, porque el
 * pago la deja pagada.
 *
 * @param {object} datos
 * @param {object} datos.patient        { id, insuranceName, insuranceTemplateUrl, insuranceTemplateProId }
 * @param {string} datos.professionalId Perfil de Raúl.
 * @param {object} [datos.cita]         Sesión que este pago deja pagada, si se eligió.
 */
export function validarPagoPalig({ patient, professionalId, cita = null, monto, confirmado, ahora = new Date() } = {}) {
  const fail = (message, code) => ({ ok: false, status: 409, message, code });
  if (!patient) return fail("Seleccione el paciente.", "PALIG_PACIENTE");
  if (!esPalig(patient.insuranceName)) return fail("El paciente no tiene PALIG registrado en su perfil.", "PALIG_ASEGURADORA");
  if (!patient.insuranceTemplateUrl || patient.insuranceTemplateProId !== professionalId) {
    return fail("Primero debe guardarse la plantilla PALIG que Raúl preparó para este paciente.", "PALIG_PLANTILLA");
  }
  if (!confirmado) return fail("Confirme que recibió hoy este pago por SINPE Móvil.", "PALIG_CONFIRMACION");
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) return fail("Indique un monto recibido mayor a cero.", "PALIG_MONTO");
  if (cita) {
    if (cita.professional?.slug !== PALIG_PROFESSIONAL_SLUG || cita.professionalId !== professionalId) {
      return fail("El piloto PALIG está disponible únicamente para atenciones de Raúl Olmedo.", "PALIG_PROFESIONAL");
    }
    if (cita.patientId !== patient.id) return fail("La sesión elegida es de otro paciente.", "PALIG_CITA_AJENA");
    if (!["PENDING", "CONFIRMED", "COMPLETED"].includes(cita.status)) {
      return fail("No se puede pagar una sesión cancelada o una inasistencia.", "PALIG_ESTADO_CITA");
    }
    if (!fechaCostaRica(cita.date) || new Date(cita.date) > ahora) {
      return fail("La sesión elegida todavía no ocurrió.", "PALIG_FECHA_FUTURA");
    }
    if (cita.paymentStatus !== "UNPAID") {
      return fail("Esa sesión ya tiene un pago registrado. Revísela antes de generar otra factura.", "PALIG_PAGO_EXISTENTE");
    }
  }
  return { ok: true };
}
