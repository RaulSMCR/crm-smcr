// src/app/mi/pagos/page.js — Pagos del paciente (server component).
//
// Fuente de verdad: PaymentTransaction + Appointment (AUDIT-PWA · RIESGOS-7).
// Los enlaces ONVO son estáticos por asignación pro-servicio, así que el enlace
// solo se ofrece para transacciones que siguen pendientes. Solo lectura: no toca
// el webhook /api/payment/webhook ni la lógica de match.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildPaymentLinkUrl } from "@/lib/onvo/client";
import { ACTIVE_PAYMENT_STATUSES } from "@/lib/mi/serializers";
import {
  Card,
  Pill,
  EmptyState,
  formatMoney,
  formatDate,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
} from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagos" };

// Una cita "no activa" (cancelada / ausente) no debería mostrar un cobro pendiente.
const INACTIVE_APPOINTMENT = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO", "NO_SHOW"];

function concepto(tx) {
  const servicio = tx.appointment?.service?.title || "Consulta";
  const fecha = tx.appointment?.date ? ` · cita del ${formatDate(tx.appointment.date)}` : "";
  return { servicio, detalle: `${PAYMENT_TYPE[tx.type] || tx.type}${fecha}` };
}

function PendienteCard({ tx }) {
  const { servicio, detalle } = concepto(tx);
  const payUrl = tx.onvoPaymentLinkId ? buildPaymentLinkUrl(tx.onvoPaymentLinkId) : null;

  return (
    <Card className="border-accent-200 ring-1 ring-accent-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{servicio}</p>
          <p className="mt-0.5 text-xs text-neutral-500">{detalle}</p>
        </div>
        <p className="shrink-0 font-bold text-neutral-900">{formatMoney(tx.amount, tx.currency)}</p>
      </div>

      {payUrl ? (
        <>
          <a
            href={payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block rounded-xl bg-accent-500 px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-accent-600"
          >
            Pagar
          </a>
          <p className="mt-2 text-center text-xs text-neutral-500">
            La acreditación puede demorar unos minutos.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-neutral-500">Te enviamos el enlace de pago a tu correo.</p>
      )}
    </Card>
  );
}

function HistorialCard({ tx }) {
  const { servicio, detalle } = concepto(tx);
  const status = PAYMENT_STATUS[tx.status] || { label: tx.status, tone: "neutral" };
  const fechaPago = tx.paidAt || tx.createdAt;

  return (
    <Card className="opacity-80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-800">{servicio}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {detalle}
            {fechaPago ? ` · ${formatDate(fechaPago)}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold text-neutral-800">{formatMoney(tx.amount, tx.currency)}</p>
          <div className="mt-1">
            <Pill tone={status.tone}>{status.label}</Pill>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function MiPagosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi/pagos");

  const patientId = String(session.userId || session.sub);

  // Aislamiento por paciente: PaymentTransaction.patientId = session.sub.
  const txs = await prisma.paymentTransaction.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      onvoPaymentLinkId: true,
      appointment: {
        select: {
          date: true,
          status: true,
          service: { select: { title: true } },
        },
      },
    },
  });

  const esPendiente = (tx) =>
    ACTIVE_PAYMENT_STATUSES.includes(tx.status) &&
    !INACTIVE_APPOINTMENT.includes(tx.appointment?.status);

  const pendientes = txs.filter(esPendiente);
  const historial = txs.filter((tx) => !esPendiente(tx));
  const pendientesTotal = pendientes.reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-brand-800">Pagos</h1>
        <p className="mt-1 text-sm text-neutral-600">Estado de tus pagos y enlaces pendientes.</p>
      </header>

      {txs.length === 0 ? (
        <EmptyState title="No tenés pagos registrados" message="Acá vas a ver tus pagos y adelantos." />
      ) : (
        <div className="space-y-6">
          {pendientes.length > 0 ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  Pendientes
                </h2>
                <span className="text-sm font-bold text-accent-700">
                  {formatMoney(pendientesTotal)}
                </span>
              </div>
              <div className="space-y-3">
                {pendientes.map((tx) => (
                  <PendienteCard key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ) : null}

          {historial.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Historial
              </h2>
              <div className="space-y-3">
                {historial.map((tx) => (
                  <HistorialCard key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
