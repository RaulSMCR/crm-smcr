import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ProfessionalAppointmentsPanel from "@/components/ProfessionalAppointmentsPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProfesionalCitasPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "PROFESSIONAL") redirect("/");

  const professionalId = String(session.professionalProfileId || "");
  if (!professionalId) redirect("/panel/profesional/perfil");

  const [appointments, serviceAssignments, availability, futureAppointments, patients] = await Promise.all([
    prisma.appointment.findMany({
      where: { professionalId },
      orderBy: { date: "asc" },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        service: { select: { id: true, title: true, price: true, durationMin: true } },
      },
      take: 300,
    }),
    prisma.serviceAssignment.findMany({
      where: {
        professionalId,
        status: "APPROVED",
        approvedSessionPrice: { not: null },
        service: { isActive: true },
      },
      select: {
        service: {
          select: {
            id: true,
            title: true,
            durationMin: true,
            price: true,
          },
        },
      },
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
    prisma.user.findMany({
      where: {
        role: "USER",
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  const initialAppointments = appointments.map((appointment) => ({
    ...appointment,
    user: appointment.patient,
  }));

  const bookingContext = {
    services: serviceAssignments.map((assignment) => assignment.service).filter(Boolean),
    availability,
    booked: futureAppointments.map((appointment) => ({
      startISO: appointment.date.toISOString(),
      endISO: appointment.endDate.toISOString(),
    })),
    patients,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <h1 className="text-3xl font-bold text-slate-800">Citas</h1>
      <p className="text-slate-500">
        Gestione las citas: crear, reagendar, aceptar, completar o marcar ausente, cuidando la continuidad del paciente.
      </p>

      <ProfessionalAppointmentsPanel
        initialAppointments={initialAppointments}
        bookingContext={bookingContext}
      />
    </div>
  );
}

