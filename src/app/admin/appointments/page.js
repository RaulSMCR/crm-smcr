import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import AdminAppointmentsManager from "@/components/admin/AdminAppointmentsManager";

export const dynamic = "force-dynamic";

export default async function AdminAppointmentsPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const appointments = await prisma.appointment.findMany({
    orderBy: { date: "asc" },
    include: {
      patient: { select: { name: true, email: true } },
      professional: { select: { user: { select: { name: true, email: true } } } },
      service: { select: { title: true } },
    },
    take: 400,
  });

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Calendario global de citas</h1>
      <p className="text-neutral-600">
        Como administrador puedes revisar y modificar el estado de cualquier cita del sistema.
      </p>

      <AdminAppointmentsManager appointments={appointments} />
    </main>
  );
}
