// src/app/pro/cobros/page.js — «Cobros» en la app de profesionales.
// Las sesiones completadas que todavía no se terminaron de pagar, con cuánto
// falta y si ya salió el enlace. Cualquier profesional reenvía el enlace de
// ONVO; solo Raúl registra pagos que entraron por otra vía (ver
// /api/pro/pagos-manuales) y tiene a mano la app de cobros PALIG.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDayTab } from "@/lib/appointment-slots";
import { montoPendiente, tipoDeCobroPendiente } from "@/lib/cobro-de-cita";
import { esPalig, PALIG_PROFESSIONAL_SLUG } from "@/lib/palig-policy";
import AccionesDeCobro from "@/components/pro/AccionesDeCobro";
import { Card, EmptyState, formatMoney, Pill, SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cobros" };

const CONCEPTO = { DEPOSIT_50: "Adelanto", BALANCE_50: "Saldo", FULL_100: "Sesión completa" };

export default async function ProCobrosPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro/cobros");
  const professionalId = String(session.professionalProfileId || "");

  const [perfil, citas] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { id: professionalId }, select: { slug: true } }),
    // Aislamiento por profesional: todas las citas son de su perfil.
    prisma.appointment.findMany({
      where: { professionalId, status: "COMPLETED", paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      orderBy: { date: "desc" },
      take: 100,
      select: {
        id: true,
        date: true,
        pricePaid: true,
        paymentStatus: true,
        isFirstWithProfessional: true,
        patient: { select: { name: true, insuranceName: true } },
        service: { select: { title: true } },
        paymentTransactions: {
          select: { type: true, amount: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  // La misma regla que exige la ruta: solo la cuenta de Raúl registra pagos
  // fuera de ONVO. Acá solo decide si se muestra el botón.
  const esRaul = perfil?.slug === PALIG_PROFESSIONAL_SLUG;

  const porCobrar = citas.map((cita) => {
    const enlace = cita.paymentTransactions.find((t) => t.status === "LINK_SENT");
    return {
      cita,
      tipo: tipoDeCobroPendiente(cita),
      monto: montoPendiente(cita, cita.paymentTransactions),
      enlaceEnviado: enlace ? enlace.createdAt : null,
      palig: esPalig(cita.patient?.insuranceName),
    };
  });
  const total = porCobrar.reduce((suma, item) => suma + item.monto, 0);

  return (
    <>
      <SectionHeader
        title="Cobros"
        subtitle={porCobrar.length ? `${porCobrar.length} por cobrar · ${formatMoney(total)}` : "Todo cobrado"}
      />

      {esRaul ? (
        <Link
          href="/panel/palig/cobro"
          className="mb-5 block rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm font-medium text-brand-900"
        >
          Cobro PALIG con comprobante SINPE →
          <span className="mt-1 block text-xs font-normal text-brand-800">
            Lee la captura, emite la factura y arma el formulario de reclamo.
          </span>
        </Link>
      ) : null}

      {porCobrar.length === 0 ? (
        <EmptyState title="Nada pendiente" message="Todas las sesiones completadas están pagadas." />
      ) : (
        <div className="space-y-3">
          {porCobrar.map(({ cita, tipo, monto, enlaceEnviado, palig }) => (
            <Card key={cita.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{cita.patient?.name || "Paciente"}</p>
                  <p className="text-sm text-neutral-600">
                    {formatDayTab(cita.date)} · {cita.service?.title || "Sesión"}
                  </p>
                  <p className="mt-1 text-lg font-bold text-brand-800">
                    {formatMoney(monto)} <span className="text-xs font-medium text-neutral-500">{CONCEPTO[tipo]}</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {enlaceEnviado ? `Enlace enviado el ${formatDayTab(enlaceEnviado)}` : "Todavía no se envió enlace"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {palig ? <Pill tone="teal">PALIG</Pill> : null}
                  {cita.paymentStatus === "PARTIALLY_PAID" ? <Pill tone="neutral">Adelanto pagado</Pill> : null}
                </div>
              </div>
              {/* A un paciente PALIG el pago se le registra por el piloto, que
                  además arma el formulario de reclamo; el botón común no lo haría. */}
              {esRaul && palig ? (
                <Link href="/panel/palig/cobro" className="mt-3 block text-xs font-semibold text-brand-700 underline">
                  Registrar el pago por el cobro PALIG
                </Link>
              ) : null}
              <AccionesDeCobro
                puedeRegistrarManual={esRaul && !palig}
                cita={{
                  id: cita.id,
                  paciente: cita.patient?.name || "el paciente",
                  fecha: formatDayTab(cita.date),
                  monto,
                  tipo,
                }}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
