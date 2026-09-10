// Lista explícita: nunca pasar payloads, cabeceras ni objetos de error al logger.
const REFERENCE_FIELDS = [
  "eventId", "onvoLinkId", "transactionId", "appointmentId",
  "invoiceId", "claimId", "status", "reason",
];

export function logOnvoWebhook(level, action, context = {}) {
  const entry = { action };
  for (const field of REFERENCE_FIELDS) {
    const value = context[field];
    if (typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,180}$/.test(value)) {
      entry[field] = value;
    }
  }
  // Los mensajes de Prisma y de proveedores pueden contener argumentos privados.
  const code = context.error?.code;
  if (typeof code === "string" && /^P\d{4}$/.test(code)) entry.errorCode = code;
  console[level]("[ONVO webhook]", entry);
}

export function escapePaymentAlertValue(value) {
  const text = value == null || value === "" ? "—" : String(value);
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
