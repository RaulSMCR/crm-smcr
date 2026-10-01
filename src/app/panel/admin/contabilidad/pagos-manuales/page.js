// src/app/panel/admin/contabilidad/pagos-manuales/page.js
//
// Reportar un pago que entró fuera de ONVO, para que se facture.
//
// La pantalla carga de antemano lo que el endpoint podría rechazar: una cita sin
// CABYS en su servicio, un cliente sin identificación fiscal. Son 409 legítimos,
// pero descubrirlos después de llenar el formulario es trabajo perdido, así que
// acá se marcan antes y la opción no se puede elegir.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { SLUG_PROFESIONAL_GESTIONADO } from "@/lib/pagos-manuales";
import { datosFacturacionDe } from "@/lib/fiscal-identity";
import { opcionesDeCuenta, cuentaDeCobro } from "@/lib/cuentas-de-cobro";
import PagoManualForm from "@/components/admin/PagoManualForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA_CITA = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const FECHA_FACTURA = new Intl.DateTimeFormat("es-CR", {
  timeZone: "America/Costa_Rica",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ETIQUETA_FE = { ACCEPTED: "Aceptada", PENDING: "Pendiente", REJECTED: "Rechazada" };

function colones(valor) {
  return `₡${Number(valor || 0).toLocaleString("es-CR")}`;
}

/** Por qué un cliente no se puede facturar todavía, o null si sí se puede. */
function faltaFiscalDe(cliente) {
  const receptor = datosFacturacionDe(cliente);
  if (!receptor.nombre || receptor.nombre.trim().length < 3) return "sin nombre completo";
  if (!receptor.tipoIdentificacion || !receptor.identificacion) return "sin identificación fiscal";
  return null;
}

export default async function PagosManualesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const profesional = await prisma.professionalProfile.findUnique({
    where: { slug: SLUG_PROFESIONAL_GESTIONADO },
    select: { id: true, user: { select: { name: true } } },
  });

  if (!profesional) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Link href="/panel/admin/contabilidad" className="text-sm text-slate-500">Volver a contabilidad</Link>
        <h1 className="text-3xl font-bold text-slate-900">Pagos manuales</h1>
        <p className="rounded-2xl border border-accent-200 bg-accent-50 p-5 text-sm text-accent-900">
          No se encontró la ficha del profesional gestionado (<code>{SLUG_PROFESIONAL_GESTIONADO}</code>).
          Sin ella no se puede reportar ningún cobro: es la única ficha a la que se le permite.
        </p>
      </main>
    );
  }

  const [citas, servicios, clientes, recientes] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        professionalId: profesional.id,
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
      },
      select: {
        id: true,
        date: true,
        status: true,
        paymentStatus: true,
        pricePaid: true,
        service: { select: { title: true, cabysCode: true, taxId: true } },
        patient: {
          select: {
            name: true, email: true, identification: true,
            billingName: true, billingIdType: true, billingIdNumber: true, billingEmail: true,
          },
        },
        // Lo ya cobrado, para poder sugerir el saldo en vez de hacerlo a mano.
        paymentTransactions: { where: { status: "APPROVED" }, select: { amount: true, type: true } },
      },
      orderBy: { date: "desc" },
      take: 120,
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, title: true, price: true, cabysCode: true, taxId: true },
      orderBy: { title: "asc" },
    }),
    // El universo realista de un cobro suelto: alguien que ya pasó por consulta
    // con él. Un cliente nuevo se crea primero en su ficha, donde se le piden los
    // datos fiscales que la factura exige.
    prisma.user.findMany({
      where: { appointments: { some: { professionalId: profesional.id } } },
      select: {
        id: true, name: true, email: true, identification: true,
        billingName: true, billingIdType: true, billingIdNumber: true, billingEmail: true,
      },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.invoice.findMany({
      where: { cuentaDeposito: { not: null } },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, total: true,
        contactName: true, cuentaDeposito: true, feStatus: true, feNumber: true, appointmentId: true,
      },
      orderBy: { invoiceDate: "desc" },
      take: 15,
    }),
  ]);

  const citasParaElFormulario = citas.map((cita) => {
    const pagado = cita.paymentTransactions.reduce((suma, t) => suma + Number(t.amount), 0);
    const precio = Number(cita.pricePaid ?? 0);
    const falta = faltaFiscalDe(cita.patient);
    return {
      id: cita.id,
      etiqueta: `${FECHA_CITA.format(cita.date)} · ${cita.patient?.name || "Paciente"} · ${cita.service?.title || "Consulta"}`,
      precio,
      pagado,
      saldo: Math.max(0, precio - pagado),
      paymentStatus: cita.paymentStatus,
      // Los dos motivos por los que el endpoint devolvería 409. Se dicen acá.
      impedimento:
        !cita.service?.cabysCode || !cita.service?.taxId
          ? `el servicio «${cita.service?.title || "—"}» no tiene CABYS o impuesto configurado`
          : falta
            ? `${cita.patient?.name || "El paciente"} está ${falta}`
            : null,
    };
  });

  const clientesParaElFormulario = clientes.map((cliente) => ({
    id: cliente.id,
    etiqueta: `${cliente.name || "Sin nombre"}${cliente.email ? ` · ${cliente.email}` : ""}`,
    impedimento: faltaFiscalDe(cliente),
  }));

  const serviciosParaElFormulario = servicios.map((servicio) => ({
    id: servicio.id,
    etiqueta: servicio.title,
    precio: Number(servicio.price ?? 0),
    impedimento: !servicio.cabysCode || !servicio.taxId ? "no tiene CABYS o impuesto configurado" : null,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <Link href="/panel/admin/contabilidad" className="text-sm text-slate-500">Volver a contabilidad</Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Pagos manuales</h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Para un cobro que no pasó por ONVO: efectivo, SINPE Móvil, una transferencia. Acá se
          reporta un pago <b>ya recibido</b>; no se le cobra nada a nadie. El sistema emite la
          factura, la manda a Hacienda y le envía el comprobante al cliente.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Solo cobros de {profesional.user?.name || "el profesional gestionado"}. Los de los demás
          profesionales se cobran por ONVO: su comisión y su escalón se calculan sobre lo que el
          procesador confirma.
        </p>
      </div>

      <PagoManualForm
        citas={citasParaElFormulario}
        clientes={clientesParaElFormulario}
        servicios={serviciosParaElFormulario}
        cuentas={opcionesDeCuenta()}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Últimos pagos reportados a mano</h2>
        {recientes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Todavía no hay ninguno.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Factura</th>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Cuenta</th>
                  <th className="py-2 pr-4">Origen</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2">Hacienda</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((factura) => (
                  <tr key={factura.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-semibold text-slate-900">{factura.invoiceNumber}</td>
                    <td className="py-2 pr-4 text-slate-600">{FECHA_FACTURA.format(factura.invoiceDate)}</td>
                    <td className="py-2 pr-4 text-slate-700">{factura.contactName || "—"}</td>
                    <td className="py-2 pr-4 text-slate-700">
                      {cuentaDeCobro(factura.cuentaDeposito)?.etiqueta || factura.cuentaDeposito}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{factura.appointmentId ? "Cita" : "Sin cita"}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-slate-900">{colones(factura.total)}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          factura.feStatus === "ACCEPTED"
                            ? "bg-brand-100 text-brand-900"
                            : factura.feStatus === "REJECTED"
                              ? "bg-accent-100 text-accent-900"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ETIQUETA_FE[factura.feStatus] || factura.feStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
