// src/app/pro/page.js — «Hoy» en la app de profesionales.
// Lo que el profesional necesita al abrir el celular: qué falta cerrar, qué le
// queda del día y qué viene después. Las sesiones vencidas se cierran desde acá,
// y al completar una se abre la «Próxima sesión» (?proxima=<id>).
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDayLong, formatDayTab, formatSlotTime } from "@/lib/appointment-slots";
import { repartirAgendaDeHoy, ventanaDeHoy } from "@/lib/pro/agenda-hoy";
import { contextoParaAgendar } from "@/lib/pro/contexto-para-agendar";
import CitaDelDia from "@/components/pro/CitaDelDia";
import ProximaSesion from "@/components/pro/ProximaSesion";
import { EmptyState, SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoy" };

/** Basta para llenar «Próximas» aunque haya días sin citas en el medio. */
const DIAS_PARA_PROXIMAS = 60;

function Seccion({ titulo, detalle, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{titulo}</h2>
      {detalle ? <p className="mb-2 text-xs text-neutral-500">{detalle}</p> : <div className="mb-2" />}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * La cita recién completada de la que sale la «Próxima sesión», o null. Se lee
 * de la base y no de la URL: el id de ?proxima solo dice cuál buscar, y tiene
 * que ser una cita completada del propio profesional.
 */
async function citaParaProximaSesion(id, professionalId, ahora) {
  if (!id) return null;
  const cita = await prisma.appointment.findFirst({
    where: { id, professionalId, status: "COMPLETED" },
    select: { id: true, date: true, patientId: true, serviceId: true, patient: { select: { name: true } } },
  });
  if (!cita) return null;

  // Si ya tiene una cita por delante, el modal la muestra para no duplicarla.
  const siguiente = await prisma.appointment.findFirst({
    where: { patientId: cita.patientId, professionalId, status: { in: ["PENDING", "CONFIRMED"] }, date: { gt: ahora } },
    orderBy: { date: "asc" },
    select: { date: true },
  });

  return {
    id: cita.id,
    date: cita.date.toISOString(),
    patientId: cita.patientId,
    patientName: cita.patient?.name || "el paciente",
    serviceId: cita.serviceId,
    nextLabel: siguiente ? `${formatDayTab(siguiente.date)}, ${formatSlotTime(siguiente.date)}` : null,
  };
}

export default async function ProHoyPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro");
  const professionalId = String(session.professionalProfileId || "");

  const ahora = new Date();
  const { desdeSinCerrar, inicioDeManana } = ventanaDeHoy(ahora);

  // Aislamiento por profesional: todas las citas son de su perfil.
  const citas = await prisma.appointment.findMany({
    where: {
      professionalId,
      status: { in: ["PENDING", "CONFIRMED"] },
      date: {
        gte: desdeSinCerrar,
        lt: new Date(inicioDeManana.getTime() + DIAS_PARA_PROXIMAS * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { date: "asc" },
    take: 300,
    select: {
      id: true,
      date: true,
      status: true,
      paymentStatus: true,
      modality: true,
      locationName: true,
      locationAddress: true,
      locationNotes: true,
      meetLink: true,
      acuerdoId: true,
      patient: { select: { name: true, phone: true } },
      service: { select: { title: true } },
    },
  });

  const { porCerrar, hoy, proximas } = repartirAgendaDeHoy(citas, ahora);

  // Next 16: searchParams es una promesa.
  const { proxima } = (await searchParams) || {};
  const anterior = await citaParaProximaSesion(String(proxima || ""), professionalId, ahora);
  // Los horarios (con Google) se piden solo cuando se va a agendar.
  const bookingContext = anterior ? await contextoParaAgendar(professionalId) : null;

  return (
    <>
      <SectionHeader title="Hoy" subtitle={formatDayLong(ahora)} />

      {anterior ? <ProximaSesion bookingContext={bookingContext} previousAppointment={anterior} /> : null}

      {porCerrar.length > 0 ? (
        <Seccion titulo="Por cerrar" detalle="Sesiones que ya empezaron: complételas o márquelas como ausentes.">
          {porCerrar.map((cita) => (
            <CitaDelDia key={cita.id} cita={cita} porCerrar mostrarDia />
          ))}
        </Seccion>
      ) : null}

      <Seccion titulo="Lo que queda del día">
        {hoy.length > 0 ? (
          hoy.map((cita) => <CitaDelDia key={cita.id} cita={cita} />)
        ) : (
          <EmptyState title="Nada más por hoy" message="No quedan citas para el resto del día." />
        )}
      </Seccion>

      {proximas.length > 0 ? (
        <Seccion titulo="Próximas">
          {proximas.map((cita) => (
            <CitaDelDia key={cita.id} cita={cita} mostrarDia />
          ))}
        </Seccion>
      ) : null}
    </>
  );
}
