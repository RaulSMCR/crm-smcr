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
  // Los NOMBRES de las cabeceras recibidas, jamás sus valores.
  //
  // Es la excepción a la regla de arriba, y es deliberada. Saber si ONVO manda
  // un secreto compartido o una firma decide si el webhook puede autenticarse:
  // la respuesta está en qué cabecera llega, y el panel de ONVO no expone las
  // cabeceras de sus propios envíos. Sin esto solo quedaba conjeturar sobre
  // documentación. Un nombre de cabecera no identifica a nadie; un valor sí, y
  // por eso acá no entra ninguno.
  if (Array.isArray(context.headerNames)) {
    const nombres = context.headerNames
      .filter((name) => typeof name === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(name))
      .slice(0, 40);
    if (nombres.length) entry.headerNames = nombres.sort().join(",");
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
