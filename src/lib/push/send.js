// src/lib/push/send.js
// Envío de Web Push con VAPID. Degrada con gracia si faltan claves y poda las
// suscripciones muertas (404/410). Nunca lanza: todos los errores se atrapan,
// para que un fallo de push jamás rompa el flujo que lo invoca (job, action).
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let vapidConfigured = null;

function ensureVapid() {
  if (vapidConfigured !== null) return vapidConfigured;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contacto@saludmentalcostarica.com";

  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys ausentes: envío de push deshabilitado.");
    vapidConfigured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function deliver(subscription, body) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      body
    );
    return { ok: true };
  } catch (err) {
    const status = err?.statusCode;
    // Suscripción muerta: se elimina para no reintentar (endpoint es @unique).
    if (status === 404 || status === 410) {
      await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
      return { ok: false, gone: true };
    }
    console.error("[push] error enviando notificación:", status || err?.message);
    return { ok: false };
  }
}

/**
 * Envía una notificación push a todas las suscripciones de uno o varios usuarios.
 * @param {string|string[]} userIds
 * @param {{ title: string, body?: string, url?: string, icon?: string }} payload
 * @returns {Promise<{ sent: number, removed: number, skipped?: boolean }>}
 */
export async function sendPushToUsers(userIds, payload) {
  if (!ensureVapid()) return { sent: 0, removed: 0, skipped: true };

  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
  if (ids.length === 0) return { sent: 0, removed: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
  const body = JSON.stringify(payload);

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      const result = await deliver(sub, body);
      if (result.ok) sent += 1;
      else if (result.gone) removed += 1;
    })
  );

  return { sent, removed };
}

export function sendPushToUser(userId, payload) {
  return sendPushToUsers([userId], payload);
}
