import { Client } from "@upstash/qstash";
import { SITE_URL } from "@/lib/site-url";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN,
});

// `APP_URL` primero porque es la variable privada que usa el worker; el resto
// sale de site-url.js, que ya acepta las cuatro públicas y tiene el dominio
// correcto como último recurso. Antes caía a "https://crm-smcr.vercel.app", un
// dominio distinto del que el sitio usa en todo lo demás.
const APP_URL = process.env.APP_URL || SITE_URL;

/**
 * Programa un recordatorio de cita vía QStash.
 * @param {object} opts
 * @param {string} opts.appointmentId - ID de la cita
 * @param {"24h"|"1h"} opts.type - Tipo de recordatorio
 * @param {Date|string} opts.sendAt - Momento en que debe enviarse
 */
export async function scheduleReminder({ appointmentId, type, sendAt }) {
  if (!process.env.QSTASH_TOKEN || !APP_URL) {
    console.log(`[QStash] SKIPPED - TOKEN: ${!!process.env.QSTASH_TOKEN}, URL: ${APP_URL}`);
    return;
  }

  const delaySec = Math.floor((new Date(sendAt).getTime() - Date.now()) / 1000);
  if (delaySec <= 0) {
    console.log(`[QStash] SKIPPED ${type} - delay negativo: ${delaySec}s`);
    return;
  }

  try {
    console.log(`[QStash] Scheduling ${type} for ${appointmentId} delay: ${delaySec}s URL: ${APP_URL}/api/reminders/send`);
    const result = await qstash.publishJSON({
      url: `${APP_URL}/api/reminders/send`,
      delay: delaySec,
      body: { appointmentId, type },
    });
    console.log(`[QStash] SUCCESS ${type}:`, result);
  } catch (err) {
    console.error(`[QStash] ERROR ${type}:`, err);
  }
}

/**
 * Programa un recordatorio de reenganche para alguien que faltó a una cita.
 *
 * Mismo patrón que scheduleReminder, con dos diferencias que importan: se ancla
 * en el paciente y no en la cita (la cita ya pasó), y el receptor vuelve a
 * comprobar antes de enviar si la persona ya reagendó. Ver lib/reenganche.
 *
 * @param {object} opts
 * @param {string} opts.patientId
 * @param {string} [opts.appointmentId] - la cita a la que faltó
 * @param {number} opts.intento - 1 = a los tres días, 2 = a los diez
 * @param {Date|string} opts.sendAt
 */
export async function scheduleReengagement({ patientId, appointmentId, intento, sendAt }) {
  if (!process.env.QSTASH_TOKEN || !APP_URL) {
    console.log(`[QStash] reenganche OMITIDO - TOKEN: ${!!process.env.QSTASH_TOKEN}, URL: ${APP_URL}`);
    return;
  }

  const delaySec = Math.floor((new Date(sendAt).getTime() - Date.now()) / 1000);
  if (delaySec <= 0) return;

  try {
    await qstash.publishJSON({
      url: `${APP_URL}/api/reenganche/send`,
      delay: delaySec,
      body: { patientId, appointmentId, intento },
    });
    console.log(`[QStash] reenganche #${intento} programado para ${patientId} en ${delaySec}s`);
  } catch (err) {
    console.error(`[QStash] ERROR reenganche #${intento}:`, err);
  }
}
