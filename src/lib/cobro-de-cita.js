// src/lib/cobro-de-cita.js
//
// Qué falta cobrar de una cita y bajo qué concepto. Puro, para que lo usen
// igual la acción que manda el enlace de ONVO, la pestaña de cobros de la app y
// el registro de un pago manual: si cada uno lo calculara por su lado, el
// enlace pediría un monto y la factura manual diría otro.

/**
 * Concepto del próximo cobro de la cita.
 *
 * La primera cita con el profesional se cobra en dos mitades (adelanto al
 * agendar, saldo al completar); las siguientes, enteras al completar.
 */
export function tipoDeCobroPendiente(cita) {
  if (cita.isFirstWithProfessional) {
    return cita.paymentStatus === "PARTIALLY_PAID" ? "BALANCE_50" : "DEPOSIT_50";
  }
  return "FULL_100";
}

/**
 * Lo ya pagado de la cita: solo cobros aprobados. Las multas no cuentan, salvo
 * que la sesión se haya dado (`contarMultas`): entonces el horario no se perdió
 * y lo pagado como multa es pago de la sesión. Es la misma regla que aplica
 * `createPaymentRequestForAppointment` al armar el enlace.
 */
export function pagadoDeCita(transacciones = [], { contarMultas = false } = {}) {
  return transacciones
    .filter((t) => t.status === "APPROVED" && (contarMultas || t.type !== "PENALTY_50"))
    .reduce((total, t) => total + Number(t.amount || 0), 0);
}

/**
 * Cuánto corresponde cobrar ahora. Una mitad es la mitad del precio congelado,
 * pero nunca más de lo que falta: si ya se pagó algo de más, no se pide otra vez.
 */
export function montoPendiente(cita, transacciones = []) {
  const precio = Number(cita.pricePaid || 0);
  const saldo = Math.max(0, precio - pagadoDeCita(transacciones, { contarMultas: cita.status === "COMPLETED" }));
  const tipo = tipoDeCobroPendiente(cita);
  const porConcepto = tipo === "FULL_100" ? precio : Math.round((precio / 2) * 100) / 100;
  return Math.min(porConcepto, saldo);
}
