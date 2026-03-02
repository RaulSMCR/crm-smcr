import { Client } from "@upstash/qstash";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL;

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
