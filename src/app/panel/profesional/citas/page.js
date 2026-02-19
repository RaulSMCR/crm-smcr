// src/app/panel/profesional/citas/page.js
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

  const appointments = await prisma.appointment.findMany({
    where: { professionalId },
    orderBy: { date: "asc" },
    include: {
      patient: { select: { id: true, name: true, email: true, phone: true } },
      service: { select: { id: true, title: true, price: true, durationMin: true } },
    },
    take: 300,
  });

  // Adapter para tu componente legacy (espera apt.user)
  const initialAppointments = appointments.map((a) => ({
    ...a,
    user: a.patient,
  }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Citas</h1>
      <p className="text-slate-500">
        Gestioná tus citas: aceptar, completar o marcar ausente.
      </p>

      <ProfessionalAppointmentsPanel initialAppointments={initialAppointments} />
    </div>
  );
}
