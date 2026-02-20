// src/app/panel/paciente/agendar/page.js
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import ProfessionalCalendarBooking from "@/components/booking/ProfessionalCalendarBooking";

export const dynamic = "force-dynamic";

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
      select: { id: true, title: true, durationMin: true, price: true, isActive: true },
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
      select: { status: true },
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

  if (!assignment || assignment.status !== "APPROVED") {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-slate-900">Agenda no disponible</h1>
        <p className="mt-2 text-slate-700">
          Este profesional aún no está habilitado para agendar en este servicio.
        </p>
        <div className="mt-4">
          <a className="text-blue-600 hover:underline" href={`/servicios/${serviceId}`}>
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
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="text-sm text-slate-600">
          <a className="hover:underline" href={`/servicios/${serviceId}`}>
            ← Volver al servicio
          </a>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mt-2">Agendar cita</h1>
        <p className="text-slate-600 mt-1">
          Servicio: <b>{service.title}</b> · Duración: <b>{service.durationMin} min</b> · Precio:{" "}
          <b>${Number(service.price)}</b>
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
