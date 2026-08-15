// src/lib/reenganche-policy.js
// La parte del reenganche que no toca la base de datos.
//
// Vive separada de lib/reenganche por la misma razón que rescheduling-policy
// vive separada de scheduling-block: las pantallas necesitan las etiquetas y el
// cálculo de días, y no pueden arrastrar Prisma al bundle del navegador.

export const CANALES = Object.freeze({
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
  LLAMADA: "LLAMADA",
  PRESENCIAL: "PRESENCIAL",
});

export const RESULTADOS_CONTACTO = Object.freeze({
  SIN_RESPUESTA: "SIN_RESPUESTA",
  RESPONDIO: "RESPONDIO",
  REAGENDO: "REAGENDO",
  NO_CONTINUA: "NO_CONTINUA",
});

export const ETIQUETAS_RESULTADO = Object.freeze({
  SIN_RESPUESTA: "Sin respuesta",
  RESPONDIO: "Respondió",
  REAGENDO: "Volvió a agendar",
  NO_CONTINUA: "No quiere continuar",
});

export const ETIQUETAS_CANAL = Object.freeze({
  EMAIL: "Correo",
  WHATSAPP: "WhatsApp",
  LLAMADA: "Llamada",
  PRESENCIAL: "En persona",
});

/**
 * Días después de la ausencia en que sale cada recordatorio automático.
 *
 * Tres y diez, no uno y dos: el día siguiente todavía duele y el mensaje se lee
 * como un reclamo. A los diez días es el último que se manda solo; de ahí en
 * adelante, si la persona no volvió, lo que hace falta es una conversación y no
 * otro correo.
 */
export const DIAS_DE_SEGUIMIENTO = Object.freeze([3, 10]);

/** Resultados que cierran la secuencia: no se le manda nada más. */
export const RESULTADOS_QUE_CIERRAN = Object.freeze([
  RESULTADOS_CONTACTO.REAGENDO,
  RESULTADOS_CONTACTO.NO_CONTINUA,
]);

/** Días transcurridos desde una fecha. null si no hay fecha. */
export function diasDesde(valor, ahora = new Date()) {
  if (!valor) return null;
  const ms = new Date(ahora).getTime() - new Date(valor).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** ¿Hace demasiado que nadie lo contacta? */
export const DIAS_ALERTA_SIN_CONTACTO = 7;

export function necesitaSeguimientoHumano(ultimoContactoAt, ahora = new Date()) {
  const dias = diasDesde(ultimoContactoAt, ahora);
  return dias === null || dias >= DIAS_ALERTA_SIN_CONTACTO;
}
