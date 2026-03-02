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
  if (!process.env.QSTASH_TOKEN || !APP_URL) return;

  const delaySec = Math.floor((new Date(sendAt).getTime() - Date.now()) / 1000);
  if (delaySec <= 0) return; // Ya pasó el momento del recordatorio

  await qstash.publishJSON({
    url: `${APP_URL}/api/reminders/send`,
    delay: delaySec,
    body: { appointmentId, type },
  });
}
