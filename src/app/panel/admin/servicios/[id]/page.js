// src/app/panel/admin/servicios/[id]/page.js
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import ServiceAssignmentsReviewPanel from "@/components/admin/ServiceAssignmentsReviewPanel";

export const dynamic = "force-dynamic";

export default async function AdminServicioDetallePage({ params }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "ADMIN") redirect("/panel");

  const serviceId = String(params?.id || "");
  if (!serviceId) notFound();

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      durationMin: true,
      isActive: true,
      professionalAssignments: {
        orderBy: { professional: { user: { name: "asc" } } },
        select: {
          status: true,
          proposedSessionPrice: true,
          approvedSessionPrice: true,
          adminReviewNote: true,
          professional: {
            select: {
              id: true,
              specialty: true,
              isApproved: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!service) notFound();

  const priceStr = service.price?.toString?.() ?? String(service.price);

  const approvedCount = service.professionalAssignments.filter(
    (a) => a.status === "APPROVED" && a.professional?.isApproved && a.professional?.user?.isActive
  ).length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-sm text-slate-600">
            <Link href="/panel/admin/servicios" className="hover:underline">
              ← Volver a servicios
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mt-2">{service.title}</h1>

          <div className="text-sm text-slate-700 mt-3">
            <b>Duración:</b> {service.durationMin} min · <b>Precio:</b> ₡{priceStr} ·{" "}
            <b>Estado:</b> {service.isActive ? "Activo" : "Inactivo"}
          </div>

          {service.description ? (
            <p className="text-slate-700 mt-4">{service.description}</p>
          ) : (
            <p className="text-slate-500 mt-4">Sin descripción.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Profesionales vinculados</h2>
            <p className="text-sm text-slate-600 mt-1">
              Aprobados y activos: <b>{approvedCount}</b> · Total vinculados:{" "}
              <b>{service.professionalAssignments.length}</b>
            </p>
          </div>
        </div>

        {service.professionalAssignments.length === 0 ? (
          <p className="mt-4 text-slate-700">No hay profesionales vinculados a este servicio.</p>
        ) : (
          <div className="mt-5">
            <ServiceAssignmentsReviewPanel
              serviceId={service.id}
              assignments={service.professionalAssignments.map((a) => ({
                ...a,
                proposedSessionPrice: a.proposedSessionPrice?.toString?.() ?? null,
                approvedSessionPrice: a.approvedSessionPrice?.toString?.() ?? null,
              }))}
            />
          </div>
        )}

        <div className="mt-6 text-xs text-slate-500">
          Nota: el vínculo se gestiona por `professionalAssignments` y su estado de aprobación.
        </div>
      </div>
    </div>
  );
}
