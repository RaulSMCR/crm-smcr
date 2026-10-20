import { Client } from "@upstash/qstash";
import { SITE_URL } from "@/lib/site-url";

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
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
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
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
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

/**
 * Despierta la cola de envíos (`/api/payments/deliveries/run`) en un momento
 * dado.
 *
 * Existe porque la aceptación de Hacienda es asincrónica: lo normal es que un
 * envío termine en PENDING y el veredicto llegue minutos después. La cola sabe
 * reconsultar con espera creciente, pero nada la ejecutaba por su cuenta: el
 * worker estaba escrito y nunca se programó, y la factura 0203 se quedó en
 * PENDING hasta que alguien consultó el estado a mano.
 *
 * En vez de un cron que pregunte cada pocos minutos aunque no haya nada —y que
 * en el plan de Vercel no entra—, la cola se despierta exactamente cuando una
 * tarea vence. Cada corrida programa la siguiente; cuando no quedan tareas
 * pendientes no se programa nada y la cadena se apaga sola. No puede girar en
 * falso: cada tarea tiene tope de intentos y al agotarlo pasa a REVIEW.
 *
 * `deduplicationId` agrupa por minuto: muchas facturas que vencen juntas
 * comparten un solo despertar, y dos corridas que programan el mismo minuto no
 * duplican el mensaje.
 *
 * Solo en producción. En desarrollo y en las pruebas `APP_URL` puede apuntar al
 * sitio real, y una corrida local despertaría la cola de producción, que habla
 * con Hacienda de verdad.
 *
 * Nunca lanza: si QStash falla, la tarea sigue en la cola y la recoge la
 * próxima corrida o el reintento manual del panel.
 *
 * @param {Date|string|number} [cuando] Momento en que vence la próxima tarea.
 * @returns {Promise<{ programado: boolean, motivo?: string, para?: Date }>}
 */
export async function despertarColaDeEnvios(cuando = Date.now()) {
  if (process.env.NODE_ENV !== "production") return { programado: false, motivo: "FUERA_DE_PRODUCCION" };
  if (!process.env.QSTASH_TOKEN || !APP_URL) return { programado: false, motivo: "SIN_CONFIGURAR" };

  // Nunca antes de 30 s: una tarea recién fallada no tiene sentido reintentarla
  // en el acto, y así una corrida no se reprograma a sí misma en bucle.
  const objetivo = Math.max(new Date(cuando).getTime() || 0, Date.now() + 30_000);
  const minuto = Math.ceil(objetivo / 60_000);

  try {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
    await qstash.publishJSON({
      url: `${APP_URL}/api/payments/deliveries/run`,
      notBefore: minuto * 60,
      deduplicationId: `smcr-cola-envios-${minuto}`,
      body: {},
    });
    return { programado: true, para: new Date(minuto * 60_000) };
  } catch {
    // Sin el error: puede traer la URL firmada o el token en el mensaje.
    console.error("[QStash] DELIVERY_WAKEUP_FAILED");
    return { programado: false, motivo: "ERROR" };
  }
}
