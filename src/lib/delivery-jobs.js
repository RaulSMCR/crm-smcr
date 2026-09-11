import { randomUUID } from "node:crypto";

const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 12;
const MAIL_WINDOW_MS = 23 * 60 * 60_000;

export class DeliveryError extends Error {
  constructor(code, review = false) {
    super(code);
    this.code = code;
    this.review = review;
  }
}

export function enqueueDelivery(tx, { kind, invoiceId, paymentTransactionId = null }) {
  const dedupeKey = `${kind}:${paymentTransactionId || invoiceId}`;
  return tx.deliveryJob.upsert({ where: { dedupeKey }, update: {}, create: {
    kind, invoiceId, paymentTransactionId, dedupeKey,
  } });
}

/** Un lease vencido se recupera; solo el propietario actual puede cerrar la tarea. */
export async function runDeliveryJob(db, id, execute, now = new Date()) {
  const token = randomUUID();
  const claimed = await db.deliveryJob.updateMany({ where: {
    id, OR: [
      { status: "PENDING", nextAttemptAt: { lte: now } },
      { status: "PROCESSING", lockedUntil: { lt: now } },
    ],
  }, data: { status: "PROCESSING", leaseToken: token, lockedUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } } });
  if (!claimed.count) return "skipped";
  const job = await db.deliveryJob.findUnique({ where: { id } });
  if (!job || job.leaseToken !== token) return "skipped";
  const owned = { id, leaseToken: token, status: "PROCESSING" };
  try {
    if (job.attempts > MAX_ATTEMPTS) throw new DeliveryError("ATTEMPTS_EXHAUSTED", true);
    if (job.kind !== "FE_SUBMISSION" && job.firstSendAt && now.getTime() - job.firstSendAt.getTime() >= MAIL_WINDOW_MS) {
      throw new DeliveryError("MAIL_WINDOW_EXPIRED", true);
    }
    const result = await execute(job, {
      // Guardar huella y fecha ANTES de enviar: el proveedor puede recibir aunque el proceso muera.
      async beforeSend(payloadHash) {
        if (job.payloadHash && job.payloadHash !== payloadHash) throw new DeliveryError("MAIL_CONTENT_CHANGED", true);
        const saved = await db.deliveryJob.updateMany({ where: { ...owned, lockedUntil: { gt: new Date() } }, data: {
          payloadHash, firstSendAt: job.firstSendAt || new Date(),
        } });
        if (!saved.count) throw new DeliveryError("LEASE_LOST", true);
      },
    });
    const saved = await db.deliveryJob.updateMany({ where: owned, data: {
      status: "SUCCEEDED", completedAt: new Date(), providerId: result?.providerId || null,
      lockedUntil: null, leaseToken: null, lastErrorCode: null,
    } });
    return saved.count ? "succeeded" : "skipped";
  } catch (error) {
    // Nunca guardar errores de proveedores, URLs, XML ni objetos de Prisma.
    const code = error instanceof DeliveryError ? error.code : "DELIVERY_FAILED";
    const review = error instanceof DeliveryError && error.review || job.attempts >= MAX_ATTEMPTS;
    const saved = await db.deliveryJob.updateMany({ where: owned, data: {
      status: review ? "REVIEW" : "PENDING", lastErrorCode: code,
      nextAttemptAt: new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(job.attempts - 1, 6))),
      lockedUntil: null, leaseToken: null,
    } });
    return saved.count ? review ? "review" : "pending" : "skipped";
  }
}

export async function drainDeliveries(db, execute, { invoiceId, limit = 2 } = {}) {
  const now = new Date();
  const jobs = await db.deliveryJob.findMany({ where: {
    ...(invoiceId ? { invoiceId } : {}),
    OR: [{ status: "PENDING", nextAttemptAt: { lte: now } }, { status: "PROCESSING", lockedUntil: { lt: now } }],
  }, orderBy: { nextAttemptAt: "asc" }, take: Math.min(2, Math.max(1, limit)), select: { id: true } });
  const results = await Promise.all(jobs.map(({ id }) => runDeliveryJob(db, id, execute)));
  return { processed: results.filter((r) => r !== "skipped").length, pending: results.filter((r) => r === "pending").length, review: results.filter((r) => r === "review").length };
}
