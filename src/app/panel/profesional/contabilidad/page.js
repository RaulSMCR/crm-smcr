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

  const [profile, transactions, submittedInvoices] = await Promise.all([
    prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: { id: true, commission: true, userId: true },
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
        total: true,
        status: true,
        invoiceDate: true,
        balance: true,
      },
      orderBy: { invoiceDate: "desc" },
      take: 50,
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
    p2pPaymentDate: t.p2pPaymentDate?.toISOString() || null,
    patientName: t.appointment?.patient?.name || "—",
    serviceTitle: t.appointment?.service?.title || "Consulta",
    appointmentDate: t.appointment?.date?.toISOString() || null,
  }));

  const invoicesForClient = submittedInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplierReference: inv.supplierReference,
    pdfUrl: inv.notes,
    total: Number(inv.total),
    status: inv.status,
    balance: Number(inv.balance),
    invoiceDate: inv.invoiceDate.toISOString(),
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Contabilidad</h1>
        <p className="text-slate-600 mt-1">Cobros, ingresos y presentacion de facturas a la plataforma para sostener una atencion segura.</p>
      </div>

      <ProfessionalBillingModule
        transactions={txForClient}
        submittedInvoices={invoicesForClient}
        commission={profile.commission}
        rangeFrom={rangeFrom.toISOString()}
        rangeTo={rangeTo.toISOString()}
      />
    </div>
  );
}

