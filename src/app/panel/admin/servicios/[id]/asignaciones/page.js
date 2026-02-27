import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import ServiceAssignmentsManager from "@/components/admin/ServiceAssignmentsManager";

export const dynamic = "force-dynamic";

export default async function AdminServicioAsignacionesPage({ params }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const serviceId = String(params?.id || "");
  if (!serviceId) notFound();

  const [service, professionals, currentAssignments] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, title: true },
    }),
    prisma.professionalProfile.findMany({
      where: {
        isApproved: true,
        user: { isActive: true },
      },
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        specialty: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.serviceAssignment.findMany({
      where: { serviceId, status: "APPROVED" },
      select: { professionalId: true },
    }),
  ]);

  if (!service) notFound();

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/panel/admin/servicios" className="text-sm text-slate-600 hover:underline">
          ← Volver a servicios
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-2">Asignaciones</h1>
        <p className="text-slate-600 mt-1">
          Seleccioná qué profesionales (aprobados por admin y activos) pertenecen al servicio: <b>{service.title}</b>.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <ServiceAssignmentsManager
          serviceId={service.id}
          professionals={professionals}
          selectedIds={currentAssignments.map((a) => a.professionalId)}
        />
      </div>
    </div>
  );
}
