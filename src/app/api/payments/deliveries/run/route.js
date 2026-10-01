import { processPaymentDeliveries } from "@/lib/payment-deliveries";
import { withQstashSignature } from "@/lib/qstash-webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cuántas veces se vacía la cola dentro de una misma invocación, y cuánto
// tiempo se le concede. `drainDeliveries` toma como máximo dos tareas por
// pasada —el tope está fijo en la librería—, así que sin estas rondas un
// programador que corra cada muchas horas nunca alcanzaría a una acumulación de
// varias facturas. Las rondas se detienen solas: una tarea que falla queda con
// su `nextAttemptAt` en el futuro y ya no se vuelve a elegir en este mismo
// recorrido, así que la ronda siguiente devuelve cero y corta.
const MAX_RONDAS = 8;
const PRESUPUESTO_MS = 45_000;

async function vaciarCola() {
  const hasta = Date.now() + PRESUPUESTO_MS;
  const total = { processed: 0, pending: 0, review: 0, rondas: 0 };

  for (let ronda = 0; ronda < MAX_RONDAS; ronda += 1) {
    const resultado = await processPaymentDeliveries();
    total.processed += resultado.processed;
    total.pending += resultado.pending;
    total.review += resultado.review;
    total.rondas += 1;
    if (!resultado.processed || Date.now() >= hasta) break;
  }

  // Una tarea que entra en REVIEW ya no se reintenta sola: espera una decisión
  // en el panel. Sin esta línea, lo único que lo delataba era entrar a mirar.
  // Solo el recuento y nada más: la cola es administrativa y por acá no pasan
  // correos, XML ni datos del paciente.
  if (total.review) console.error("[deliveries] REVIEW_REQUIRED", { count: total.review });

  return total;
}

/**
 * Autorización por secreto compartido, igual que `/api/cron/settlements`.
 *
 * Sin `CRON_SECRET` configurado se rechaza en producción y se permite en
 * desarrollo, que es la misma regla que ya usa el cron de liquidaciones.
 */
function autorizado(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Entrada para cualquier programador externo (QStash, un cron de Vercel, una
 * tarea de GitHub Actions, cron-job.org).
 *
 * Por qué existe además del POST de QStash: la aceptación de Hacienda es
 * asincrónica. El comprobante se envía y la confirmación llega después, así que
 * la tarea `FE_SUBMISSION` queda en PENDING esperando, y sin nadie que la
 * reintente la factura no se acepta nunca y el correo con el comprobante no
 * sale. Eso no es un caso raro: es lo que pasa con todas las facturas. El
 * worker firmado por QStash estaba escrito pero nunca se programó, y en el plan
 * Hobby de Vercel los cupos de cron son escasos, así que atarlo a un solo
 * proveedor era dejarlo apagado.
 *
 * Reintentar es seguro: `submitToHacienda` consulta la clave antes de enviar y,
 * si Hacienda ya la tiene, devuelve ese estado en vez de emitir de nuevo.
 */
export async function GET(request) {
  if (!autorizado(request)) return Response.json({ ok: false }, { status: 401 });
  try {
    return Response.json(await vaciarCola());
  } catch {
    console.error("[deliveries] WORKER_FAILED");
    return Response.json({ ok: false }, { status: 500 });
  }
}

// Programar en QStash después del despliegue. Cada llamada vacía la cola por rondas.
export const POST = withQstashSignature(async () => {
  try {
    return Response.json(await vaciarCola());
  } catch {
    console.error("[deliveries] WORKER_FAILED");
    return Response.json({ ok: false }, { status: 500 });
  }
});
