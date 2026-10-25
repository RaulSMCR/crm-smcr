import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePaligOperator } from "@/lib/palig-auth";
import { esPalig, fechaCostaRica, PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
import { PALIG_CLAIM_SELECT, resumenPalig } from "@/lib/palig-service";
import PaligPilot from "@/components/palig/PaligPilot";

export const dynamic = "force-dynamic";

export default async function PaligPage() {
  const auth = await requirePaligOperator();
  if (auth.error) redirect("/panel");
  const now = new Date();
  const today = fechaCostaRica(now);
  const professional = { slug: PALIG_PROFESSIONAL_SLUG };
  const profile = await prisma.professionalProfile.findUnique({ where: professional, select: { id: true } });
  let appointments, patients, claims, invoices;
  try {
    [appointments, patients, claims, invoices] = await Promise.all([
      // Sesiones que el pago puede dejar pagadas (opcional): ya ocurridas, sin
      // pago ni trámite, de los últimos 90 días.
      prisma.appointment.findMany({
        where: { professional, date: { gte: new Date(now.getTime() - 90 * 24 * 3600_000), lte: now }, paymentStatus: "UNPAID", status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] }, insuranceClaim: null },
        select: { id: true, date: true, patientId: true, pricePaid: true, service: { select: { title: true, price: true } }, patient: { select: { insuranceName: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ appointments: { some: { professional } } }, { casosComoPaciente: { some: { professional } } }],
        },
        select: { id: true, name: true, insuranceName: true, insuranceTemplateUrl: true, insuranceTemplateProId: true },
        orderBy: { name: "asc" },
      }),
      prisma.insuranceClaim.findMany({
        where: { professional, invoiceId: { not: null } },
        select: { ...PALIG_CLAIM_SELECT, patient: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, take: 30,
      }),
      // Pagos por SINPE ya facturados sin formulario (p. ej. desde pagos
      // manuales): se les genera el formulario sin emitir otra factura.
      prisma.invoice.findMany({
        where: {
          professional, invoiceType: "CUSTOMER_INVOICE", status: "PAID", cuentaDeposito: "SINPE_MOVIL",
          insuranceClaim: null, paymentDate: { gte: new Date(now.getTime() - 60 * 24 * 3600_000) },
        },
        select: { id: true, invoiceNumber: true, total: true, paymentDate: true, contactId: true },
        orderBy: { paymentDate: "desc" },
      }),
    ]);
  } catch (error) {
    if (!["P2021", "P2022"].includes(error?.code)) throw error;
    return <div className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Piloto PALIG</h1><p className="mt-4">El piloto está pendiente de activación. La configuración debe completarse antes de registrar pagos aquí.</p></div>;
  }
  return <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
    <header><Link className="text-sm text-blue-700 underline" href={auth.isAdmin ? "/panel/admin/contabilidad" : "/panel/profesional"}>Volver al panel</Link><h1 className="mt-3 text-3xl font-bold">Pagos y seguros · Raúl Olmedo</h1><p className="mt-2 text-slate-600">Piloto PALIG. 1) Guarde la plantilla de cada paciente. 2) Con cada comprobante SINPE, el sistema emite la factura y el formulario con la fecha del pago. 3) Descargue el formulario, fírmelo y súbalo: le llega al paciente por correo con la factura.</p></header>
    <PaligPilot today={today}
      sessions={appointments.filter((a) => esPalig(a.patient.insuranceName)).map((a) => ({
        id: a.id, patientId: a.patientId, amount: Number(a.pricePaid ?? a.service?.price ?? 0),
        label: `${a.date.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", weekday: "short", day: "numeric", month: "short" })} ${a.date.toLocaleTimeString("es-CR", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit" })} · ${a.service?.title || "Consulta"}`,
      }))}
      patients={patients.filter((p) => esPalig(p.insuranceName)).map((p) => ({
        id: p.id, name: p.name,
        templateReady: Boolean(p.insuranceTemplateUrl && profile && p.insuranceTemplateProId === profile.id),
        // El nombre del archivo marca la escaneada (ver la ruta de plantillas).
        templateEscaneada: String(p.insuranceTemplateUrl || "").includes("/palig-escaneada-"),
      }))}
      invoices={invoices.map((i) => ({
        id: i.id, patientId: i.contactId, amount: Number(i.total),
        label: `Factura ${i.invoiceNumber} · ₡${Number(i.total).toLocaleString("es-CR")} · pagada el ${i.paymentDate.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" })}`,
      }))}
      recent={claims.map((c) => ({ ...resumenPalig(c), date: c.invoice.invoiceDate.toISOString(), patientName: c.patient.name }))}
    />
  </div>;
}
