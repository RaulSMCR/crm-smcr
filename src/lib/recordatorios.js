// src/lib/recordatorios.js
//
// Cuándo se le recuerda una cita al paciente, dicho en un solo lugar. Antes
// cada flujo que agenda (paciente, profesional, admin, acuerdos) repetía los
// dos plazos a mano.
//
// El último recordatorio sale 10 minutos antes porque es el que lleva el enlace
// de Meet de las sesiones virtuales: con una hora de anticipación el enlace se
// perdía entre otros correos.

export const RECORDATORIOS = [
  { type: "24h", antesMs: 24 * 60 * 60 * 1000 },
  { type: "10m", antesMs: 10 * 60 * 1000 },
];

/** Tipo del recordatorio que lleva el enlace de la videollamada. */
export const RECORDATORIO_FINAL = "10m";

/** Cómo se nombra cada plazo en el correo. "1h" queda por los mensajes ya programados con el plazo anterior. */
export const PLAZO_DE_RECORDATORIO = { "24h": "24 horas", "10m": "10 minutos", "1h": "1 hora" };

/**
 * Los argumentos de `scheduleReminder` para cada recordatorio de la cita. Viaja
 * la fecha de la cita para que el receptor descarte el recordatorio si la cita
 * se reagendó después de programarlo.
 *
 * @param {{ id: string, date: Date|string }} cita
 */
export function recordatoriosDeCita(cita) {
  const inicio = new Date(cita.date);
  return RECORDATORIOS.map(({ type, antesMs }) => ({
    appointmentId: cita.id,
    type,
    sendAt: new Date(inicio.getTime() - antesMs),
    appointmentDate: inicio.toISOString(),
  }));
}
