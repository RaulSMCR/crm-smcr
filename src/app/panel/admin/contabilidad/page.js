import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import BillingInvoicesManager from "@/components/admin/BillingInvoicesManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = ["day", "week", "month", "custom"];
const INVOICE_FILTERS = [
  "all",
  "customer",
  "supplier",
  "customer_invoice",
  "supplier_invoice",
  "customer_credit_note",
  "supplier_credit_note",
];

function toDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMoney(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getPeriodRange(period, baseDate, fromInput, toInput) {
  const now = new Date();
  const base = baseDate ? new Date(baseDate) : now;
  if (Number.isNaN(base.getTime())) return getPeriodRange("day", null, null, null);

  if (period === "custom") {
    const from = fromInput ? new Date(fromInput) : new Date(base);
    const to = toInput ? new Date(toInput) : new Date(base);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return getPeriodRange("day", null, null, null);
    }

    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);
    const endExclusive = new Date(to);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return { from, to: endExclusive, label: `${toDateInput(from)} a ${toDateInput(to)}` };
  }

  if (period === "week") {
    const dayOfWeek = base.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const from = new Date(base);
    from.setDate(base.getDate() + diffToMonday);
    from.setHours(0, 0, 0, 0);
    const endExclusive = new Date(from);
    endExclusive.setDate(endExclusive.getDate() + 7);
    return { from, to: endExclusive, label: `Semana de ${toDateInput(from)}` };
  }

  if (period === "month") {
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const endExclusive = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    endExclusive.setHours(0, 0, 0, 0);
    return {
      from,
      to: endExclusive,
      label: from.toLocaleDateString("es-CR", { month: "long", year: "numeric" }),
    };
  }

  const from = new Date(base);
  from.setHours(0, 0, 0, 0);
  const endExclusive = new Date(from);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { from, to: endExclusive, label: toDateInput(from) };
}

function invoiceTypeWhere(invoiceType) {
  if (invoiceType === "customer") return { in: ["CUSTOMER_INVOICE", "CUSTOMER_CREDIT_NOTE"] };
  if (invoiceType === "supplier") return { in: ["SUPPLIER_INVOICE", "SUPPLIER_CREDIT_NOTE"] };
  if (invoiceType === "customer_invoice") return "CUSTOMER_INVOICE";
  if (invoiceType === "supplier_invoice") return "SUPPLIER_INVOICE";
  if (invoiceType === "customer_credit_note") return "CUSTOMER_CREDIT_NOTE";
  if (invoiceType === "supplier_credit_note") return "SUPPLIER_CREDIT_NOTE";
  return undefined;
}

export default async function AdminAccountingPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const period = PERIODS.includes(String(searchParams?.period || ""))
    ? String(searchParams.period)
    : "week";
  const anchorDate = String(searchParams?.date || "") || toDateInput(new Date());
  const fromInput = String(searchParams?.from || "");
  const toInput = String(searchParams?.to || "");
  const professionalId = String(searchParams?.professionalId || "");
  const patientId = String(searchParams?.patientId || "");
  const invoiceType = INVOICE_FILTERS.includes(String(searchParams?.invoiceType || ""))
    ? String(searchParams.invoiceType)
    : "all";

  const range = getPeriodRange(period, anchorDate, fromInput, toInput);

  const [professionals, patients, appointments, invoices] = await Promise.all([
    prisma.professionalProfile.findMany({
      where: { isApproved: true },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
      take: 300,
    }),
    prisma.user.findMany({
      where: { role: "USER", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.appointment.findMany({
      where: {
        date: { gte: range.from, lt: range.to },
        ...(professionalId ? { professionalId } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: {
        service: { select: { title: true, price: true } },
        professional: { select: { id: true, user: { select: { name: true } } } },
        patient: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
      take: 300,
    }),
    prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: range.from, lt: range.to },
        ...(invoiceType !== "all" ? { invoiceType: invoiceTypeWhere(invoiceType) } : {}),
        ...(professionalId ? { professionalId } : {}),
        ...(patientId ? { contactId: patientId } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        invoiceDate: true,
        contactName: true,
        professional: { select: { user: { select: { name: true } } } },
        total: true,
        amountPaid: true,
        balance: true,
      },
      orderBy: { invoiceDate: "desc" },
      take: 300,
    }),
  ]);

  const appointmentRevenue = appointments.reduce(
    (acc, appt) => acc + Number(appt.pricePaid ?? appt.service?.price ?? 0),
    0
  );
  const pendingAppointments = appointments.filter((a) => a.status === "PENDING").length;
  const completedAppointments = appointments.filter((a) => a.status === "COMPLETED").length;

  const byProfessionalMap = new Map();
  const byPatientMap = new Map();

  for (const appt of appointments) {
    const amount = Number(appt.pricePaid ?? appt.service?.price ?? 0);
    const pKey = appt.professional?.id || "none";
    const pCurrent = byProfessionalMap.get(pKey) || {
      name: appt.professional?.user?.name || "Sin profesional",
      count: 0,
      total: 0,
    };
    pCurrent.count += 1;
    pCurrent.total += amount;
    byProfessionalMap.set(pKey, pCurrent);

    const uKey = appt.patient?.id || "none";
    const uCurrent = byPatientMap.get(uKey) || {
      name: appt.patient?.name || "Sin paciente",
      count: 0,
      total: 0,
    };
    uCurrent.count += 1;
    uCurrent.total += amount;
    byPatientMap.set(uKey, uCurrent);
  }

  const byProfessional = [...byProfessionalMap.values()].sort((a, b) => b.total - a.total);
  const byPatient = [...byPatientMap.values()].sort((a, b) => b.total - a.total);

  const customerInvoices = invoices.filter((i) =>
    ["CUSTOMER_INVOICE", "CUSTOMER_CREDIT_NOTE"].includes(i.invoiceType)
  );
  const supplierInvoices = invoices.filter((i) =>
    ["SUPPLIER_INVOICE", "SUPPLIER_CREDIT_NOTE"].includes(i.invoiceType)
  );
  const customerTotal = customerInvoices.reduce((acc, i) => acc + Number(i.total), 0);
  const supplierTotal = supplierInvoices.reduce((acc, i) => acc + Number(i.total), 0);
  const invoicesPending = invoices.reduce((acc, i) => acc + Number(i.balance), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/panel/admin" className="text-sm text-slate-500 hover:text-slate-700">
              Panel
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Control financiero</h1>
            <p className="text-sm text-slate-600">Vista consolidada por período: {range.label}</p>
          </div>
          <div className="flex gap-2">
            {["day", "week", "month"].map((quick) => (
              <Link
                key={quick}
                href={`/panel/admin/contabilidad?period=${quick}&date=${anchorDate}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  period === quick
                    ? "bg-brand-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {quick === "day" ? "Diario" : quick === "week" ? "Semanal" : "Mensual"}
              </Link>
            ))}
          </div>
        </div>

        <form className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <select name="period" defaultValue={period} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
              <option value="custom">Personalizado</option>
            </select>

            <input type="date" name="date" defaultValue={anchorDate} className="rounded-lg border border-slate-300 px-3 py-2" />
            <input type="date" name="from" defaultValue={fromInput} className="rounded-lg border border-slate-300 px-3 py-2" />
            <input type="date" name="to" defaultValue={toInput} className="rounded-lg border border-slate-300 px-3 py-2" />

            <select name="professionalId" defaultValue={professionalId} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Todos los profesionales</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.user?.name || "Sin nombre"}
                </option>
              ))}
            </select>

            <select name="patientId" defaultValue={patientId} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="">Todos los pacientes</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select name="invoiceType" defaultValue={invoiceType} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="all">Facturas: todas</option>
              <option value="customer">Facturas cliente (incluye NC)</option>
              <option value="supplier">Facturas proveedor (incluye NC)</option>
              <option value="customer_invoice">Solo factura cliente</option>
              <option value="supplier_invoice">Solo factura proveedor</option>
              <option value="customer_credit_note">Solo nota crédito cliente</option>
              <option value="supplier_credit_note">Solo nota crédito proveedor</option>
            </select>

            <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700">
              Aplicar filtros
            </button>
            <Link
              href="/panel/admin/contabilidad"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center font-semibold text-slate-700 hover:bg-slate-100"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Citas</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{appointments.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Ingreso agenda</p>
            <p className="mt-2 text-2xl font-bold text-brand-700">{toMoney(appointmentRevenue)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Pendientes agenda</p>
            <p className="mt-2 text-2xl font-bold text-accent-700">{pendingAppointments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Completadas agenda</p>
            <p className="mt-2 text-2xl font-bold text-brand-800">{completedAppointments}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Facturación cliente</p>
            <p className="mt-2 text-2xl font-bold text-brand-700">{toMoney(customerTotal)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Facturación proveedor</p>
            <p className="mt-2 text-2xl font-bold text-accent-700">{toMoney(supplierTotal)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-semibold text-slate-800">Por profesional</div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Profesional</th>
                    <th className="px-4 py-2 text-right">Citas</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {byProfessional.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-right">{row.count}</td>
                      <td className="px-4 py-2 text-right font-semibold">{toMoney(row.total)}</td>
                    </tr>
                  ))}
                  {byProfessional.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                        Sin datos para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-semibold text-slate-800">Por paciente</div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Paciente</th>
                    <th className="px-4 py-2 text-right">Citas</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {byPatient.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className="border-t border-slate-100">
                      <td className="px-4 py-2">{row.name}</td>
                      <td className="px-4 py-2 text-right">{row.count}</td>
                      <td className="px-4 py-2 text-right font-semibold">{toMoney(row.total)}</td>
                    </tr>
                  ))}
                  {byPatient.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                        Sin datos para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-800">Facturas del período</h2>
            <div className="text-sm text-slate-600">
              Saldo pendiente total: <b>{toMoney(invoicesPending)}</b>
            </div>
          </div>
          <div className="p-4">
            <BillingInvoicesManager
              invoices={invoices.map((invoice) => ({
                ...invoice,
                total: Number(invoice.total),
                amountPaid: Number(invoice.amountPaid),
                balance: Number(invoice.balance),
                professionalName: invoice.professional?.user?.name || null,
              }))}
              patients={patients}
              professionals={professionals}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
