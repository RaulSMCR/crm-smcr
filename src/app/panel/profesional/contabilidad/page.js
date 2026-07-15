// src/app/panel/profesional/contabilidad/page.js
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSession as getAuthSession } from "@/actions/auth-actions";
import ProfessionalBillingModule from "@/components/profesional/ProfessionalBillingModule";

export const dynamic = "force-dynamic";

function parseDateParam(val, fallback) {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function ProfesionalContabilidadPage({ searchParams }) {
  const session = await getAuthSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/panel");

  const professionalId = String(session.professionalProfileId || "");
  if (!professionalId) redirect("/panel/profesional/perfil");

  // Rango: default últimos 90 días
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date();
  defaultTo.setHours(23, 59, 59, 999);

  const rangeFrom = parseDateParam(searchParams?.from, defaultFrom);
  const rangeTo = parseDateParam(searchParams?.to, defaultTo);

  const [profile, transactions, submittedInvoices, settlements] = await Promise.all([
    prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { id: true, userId: true },
    }),

    prisma.paymentTransaction.findMany({
      where: {
        professionalId,
        createdAt: { gte: rangeFrom, lte: rangeTo },
      },
      include: {
        appointment: {
          select: {
            date: true,
            service: { select: { title: true } },
            patient: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),

    prisma.invoice.findMany({
      where: {
        professionalId,
        invoiceType: "SUPPLIER_INVOICE",
      },
      select: {
        id: true,
        invoiceNumber: true,
        supplierReference: true,
        notes: true,
        attachmentUrl: true,
        xmlUrl: true,
        supplierFeClave: true,
        supplierIdNumber: true,
        acceptanceStatus: true,
        acceptanceAt: true,
        total: true,
        status: true,
        invoiceDate: true,
        balance: true,
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
    }),
    prisma.settlement.findMany({
      where: { professionalId },
      include: { items: { include: { transaction: { include: { appointment: { select: { date: true, patient: { select: { name: true } } } } } } } }, invoice: { select: { id: true, total: true, status: true } } },
      orderBy: { periodStart: "desc" },
      take: 24,
    }),
  ]);

  if (!profile) redirect("/panel/profesional/perfil");

  // Serializar para el cliente
  const txForClient = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    paidAt: t.paidAt?.toISOString() || null,
    patientName: t.appointment?.patient?.name || "—",
    serviceTitle: t.appointment?.service?.title || "Consulta",
    appointmentDate: t.appointment?.date?.toISOString() || null,
  }));

  const invoicesForClient = submittedInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplierReference: inv.supplierReference,
    pdfUrl: inv.attachmentUrl || inv.notes,
    xmlUrl: inv.xmlUrl,
    supplierFeClave: inv.supplierFeClave,
    acceptanceStatus: inv.acceptanceStatus,
    total: Number(inv.total),
    status: inv.status,
    balance: Number(inv.balance),
    invoiceDate: inv.invoiceDate.toISOString(),
  }));
  const settlementsForClient = settlements.map((row) => ({
    id: row.id, periodStart: row.periodStart.toISOString(), periodEnd: row.periodEnd.toISOString(),
    grossAmount: Number(row.grossAmount), commissionAmt: Number(row.commissionAmt), processingFeeAmt: Number(row.processingFeeAmt), netAmount: Number(row.netAmount), status: row.status,
    invoiceId: row.invoiceId, items: row.items.map((item) => ({ date: item.transaction.appointment?.date?.toISOString(), patientName: item.transaction.appointment?.patient?.name || "Paciente", amount: Number(item.amount), commissionAmt: Number(item.commissionAmt), processingFeeAmt: Number(item.processingFeeAmt), netAmount: Number(item.netAmount) })),
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Contabilidad</h1>
        <p className="text-slate-600 mt-1">Cobros, ingresos y presentacion de facturas del profesional.</p>
      </div>

      <ProfessionalBillingModule
        transactions={txForClient}
        submittedInvoices={invoicesForClient}
        settlements={settlementsForClient}
        rangeFrom={rangeFrom.toISOString()}
        rangeTo={rangeTo.toISOString()}
      />
    </div>
  );
}

