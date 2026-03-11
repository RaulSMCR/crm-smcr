import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import ProfessionalCalendarBooking from "@/components/booking/ProfessionalCalendarBooking";

export const dynamic = "force-dynamic";

function formatCRC(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default async function PacienteAgendarPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "USER") redirect("/panel");

  const professionalId = String(searchParams?.professionalId ?? "");
  const serviceId = String(searchParams?.serviceId ?? "");
  if (!professionalId || !serviceId) redirect("/servicios");

  const [service, professional, assignment, availability, appts] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, title: true, durationMin: true, isActive: true },
    }),
    prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        specialty: true,
        isApproved: true,
        user: { select: { name: true, image: true, isActive: true } },
      },
    }),
    prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
      select: { status: true, approvedSessionPrice: true },
    }),
    prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: {
        professionalId,
        status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"] },
        date: { gte: new Date() },
      },
      select: { date: true, endDate: true },
      orderBy: { date: "asc" },
    }),
  ]);

  if (!service?.isActive) redirect("/servicios");
  if (!professional?.isApproved || !professional.user?.isActive) redirect("/servicios");

  if (!assignment || assignment.status !== "APPROVED" || assignment.approvedSessionPrice == null) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Agenda no disponible</h1>
        <p className="mt-2 text-slate-700">
          Este profesional aún no está habilitado para agendar en este servicio.
        </p>
        <div className="mt-4">
          <a className="text-brand-800 hover:text-brand-900 hover:underline" href={`/servicios/${serviceId}`}>
            Volver al servicio
          </a>
        </div>
      </div>
    );
  }

  const booked = appts
    .filter((a) => a?.date && a?.endDate)
    .map((a) => ({
      startISO: a.date.toISOString(),
      endISO: a.endDate.toISOString(),
    }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div>
        <div className="text-sm text-slate-600">
          <a className="hover:underline" href={`/servicios/${serviceId}`}>
            Volver al servicio
          </a>
        </div>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">Agendar cita</h1>
        <p className="mt-1 text-slate-600">
          Servicio: <b>{service.title}</b> · Duración: <b>{service.durationMin} min</b> · Tarifa aprobada:{" "}
          <b>{formatCRC(assignment.approvedSessionPrice)}</b>
        </p>
      </div>

      <ProfessionalCalendarBooking
        serviceId={service.id}
        professionalId={professional.id}
        professionalName={professional.user?.name || "Profesional"}
        professionalImage={professional.user?.image || null}
        durationMin={service.durationMin}
        availability={availability}
        booked={booked}
      />
    </div>
  );
}
