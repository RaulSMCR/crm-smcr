// src/app/mi/agenda/page.js — Agenda del paciente (server component).
// Consulta las citas server-side y delega la interacción (cancelar / reagendar /
// confirmar) a AgendaList, que reutiliza los server actions y modales existentes.
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { appointmentSelect, UPCOMING_STATUSES } from "@/lib/mi/serializers";
import AgendaList from "@/components/mi/AgendaList";
import PushOptIn from "@/components/mi/PushOptIn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

const ANTERIORES_LIMIT = 10;

export default async function MiAgendaPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi/agenda");

  const patientId = String(session.userId || session.sub);
  const now = Date.now();

  // Aislamiento por paciente: todas las citas son de patientId = session.sub.
  const appointments = await prisma.appointment.findMany({
    where: { patientId },
    orderBy: { date: "desc" },
    select: appointmentSelect,
  });

  const esFutura = (a) =>
    new Date(a.date).getTime() > now && UPCOMING_STATUSES.includes(a.status);

  const futuras = appointments
    .filter(esFutura)
    .sort((x, y) => new Date(x.date) - new Date(y.date));

  const anteriores = appointments.filter((a) => !esFutura(a)).slice(0, ANTERIORES_LIMIT);

  return (
    <>
      <PushOptIn />
      <AgendaList futuras={futuras} anteriores={anteriores} />
    </>
  );
}
