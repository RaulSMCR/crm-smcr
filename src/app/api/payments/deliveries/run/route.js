import { processPaymentDeliveries } from "@/lib/payment-deliveries";
import { withQstashSignature } from "@/lib/qstash-webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Programar en QStash después del despliegue. Cada llamada recupera hasta dos tareas.
export const POST = withQstashSignature(async () => {
  try {
    return Response.json(await processPaymentDeliveries());
  } catch {
    console.error("[deliveries] WORKER_FAILED");
    return Response.json({ ok: false }, { status: 500 });
  }
});
