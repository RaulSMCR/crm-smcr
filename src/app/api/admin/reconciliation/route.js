import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createAutoInvoice } from "@/app/api/payment/webhook/route";

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
  const unmatched = await prisma.unmatchedPayment.findUnique({ where: { id: unmatchedId } });
  const transaction = await prisma.paymentTransaction.findUnique({ where: { id: transactionId }, include: { patient: true, professional: { include: { user: true } }, appointment: { include: { service: true } } } });
  if (!unmatched || unmatched.resolvedAt || !transaction) return NextResponse.json({ message: "Pago o transacción no disponibles." }, { status: 404 });
  const nextPaymentStatus = transaction.type === "DEPOSIT_50" ? "PARTIALLY_PAID" : "PAID";
  await prisma.$transaction([
    prisma.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "APPROVED", paidAt: new Date(), statusMessage: "Conciliado manualmente por ADMIN" } }),
    prisma.appointment.update({ where: { id: transaction.appointmentId }, data: { paymentStatus: nextPaymentStatus } }),
    prisma.unmatchedPayment.update({ where: { id: unmatched.id }, data: { resolvedAt: new Date(), resolvedTxId: transaction.id } }),
  ]);
  await createAutoInvoice(transaction);
  return NextResponse.json({ success: true });
}
