import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { reconcileOnvoPayment } from "@/lib/onvo/process-payment";
import { sendAdminPaymentAlert } from "@/lib/onvo/payment-alert";
import { obtenerTipoCambio } from "@/lib/exchange-rate";
import { logOnvoWebhook } from "@/lib/onvo/observability";
import { reportDepositConversion } from "@/lib/analytics/reportDepositConversion";
import { sendPurchaseMeta } from "@/lib/analytics/meta-events";

export const dynamic = "force-dynamic";

function range(request) {
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const to = new Date(url.searchParams.get("to") || new Date());
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

async function admin() {
  const session = await getSession();
  return session?.role === "ADMIN";
}

export async function GET(request) {
  if (!(await admin())) return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  const { from, to } = range(request);
  const [transactions, invoices, unmatched] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { status: "APPROVED", paidAt: { gte: from, lte: to } },
      include: { appointment: { select: { id: true, patient: { select: { name: true } }, professional: { select: { user: { select: { name: true } } } } } } },
      orderBy: { paidAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { invoiceType: "CUSTOMER_INVOICE", invoiceDate: { gte: from, lte: to }, status: { in: ["OPEN", "PAID"] } },
      select: { id: true, invoiceNumber: true, total: true, appointmentId: true, status: true },
    }),
    prisma.unmatchedPayment.findMany({ where: { resolvedAt: null, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: "desc" } }),
  ]);
  const invoiceByAppointment = new Map(invoices.filter((i) => i.appointmentId).map((i) => [i.appointmentId, i]));
  const txIds = new Set(transactions.map((t) => t.appointmentId));
  const paymentsWithoutInvoice = transactions.filter((t) => !invoiceByAppointment.has(t.appointmentId));
  const invoicesWithoutPayment = invoices.filter((i) => !txIds.has(i.appointmentId));
  const gross = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  return NextResponse.json({ from, to, summary: { approvedCount: transactions.length, gross }, paymentsWithoutInvoice, invoicesWithoutPayment, unmatched });
}

export async function POST(request) {
  if (!(await admin())) return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const unmatchedId = String(body.unmatchedId || "");
  const transactionId = String(body.transactionId || "");
  if (!unmatchedId || !transactionId) return NextResponse.json({ message: "Faltan datos." }, { status: 400 });
  try {
    const { rate } = await obtenerTipoCambio();
    const result = await reconcileOnvoPayment(prisma, { unmatchedId, transactionId, usdCrcRate: rate });
    if (result.kind === "not_found") return NextResponse.json({ message: "Pago o transacción no disponibles." }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ message: "El cobro ya fue aplicado o sus datos no coinciden con la transacción." }, { status: 409 });
    if (result.kind === "duplicate") return NextResponse.json({ success: true });
    if (result.transaction.type === "DEPOSIT_50") {
      after(() => reportDepositConversion(transactionId).catch((error) =>
        logOnvoWebhook("error", "DEPOSIT_CONVERSION_FAILED", { transactionId, error })
      ));
      after(() => sendPurchaseMeta(transactionId));
    }
    if (result.fiscalWarning) {
      const transaction = result.transaction;
      await sendAdminPaymentAlert({
        subject: "Servicio sin CABYS/IVA configurado",
        reason: "Servicio sin CABYS/IVA configurado: revisar antes de enviar a Hacienda",
        eventId: transaction.onvoEventId, onvoLinkId: transaction.onvoPaymentLinkId,
        amount: transaction.amount, currency: transaction.currency, paymentRecorded: true,
      }).catch((error) => logOnvoWebhook("error", "FISCAL_ALERT_FAILED", { transactionId, error }));
    }
    return NextResponse.json({ success: true, fiscalWarning: result.fiscalWarning });
  } catch (error) {
    logOnvoWebhook("error", "MANUAL_RECONCILIATION_FAILED", { transactionId, error });
    return NextResponse.json({ message: "No se pudo completar la conciliación. Inténtelo de nuevo." }, { status: 500 });
  }
}
