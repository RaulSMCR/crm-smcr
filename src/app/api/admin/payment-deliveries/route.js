import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-guards";
import { processPaymentDeliveries } from "@/lib/payment-deliveries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const jobs = await prisma.deliveryJob.findMany({ where: { status: { not: "SUCCEEDED" } },
      orderBy: { createdAt: "asc" }, take: 50,
      select: { id: true, kind: true, status: true, attempts: true, nextAttemptAt: true,
        lastErrorCode: true, firstSendAt: true, invoice: { select: { invoiceNumber: true } } },
    });
    return Response.json({ jobs });
  } catch {
    return Response.json({ message: "No se pudieron consultar los envíos." }, { status: 503 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  // Defensa adicional para la acción de reenvío con sesión de navegador.
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Origen no permitido." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.retryJobId) {
      if (typeof body.retryJobId !== "string" || body.retryJobId.length > 180) return Response.json({ message: "Referencia inválida." }, { status: 400 });
      // Solo desbloquear correo nunca intentado o una consulta fiscal que reutiliza su documento.
      const reset = await prisma.deliveryJob.updateMany({ where: {
        id: body.retryJobId, status: "REVIEW", OR: [{ kind: "FE_SUBMISSION" }, { firstSendAt: null }],
      }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastErrorCode: null } });
      if (!reset.count) return Response.json({ message: "Debe comprobar el resultado del envío en el proveedor; no se habilitó un reenvío automático." }, { status: 409 });
      console.info("[deliveries] ADMIN_RETRY", { jobId: body.retryJobId, adminId: auth.session.sub || auth.session.userId });
    }
    return Response.json(await processPaymentDeliveries());
  } catch {
    return Response.json({ message: "No se pudo procesar la cola. Las tareas se conservan." }, { status: 503 });
  }
}
