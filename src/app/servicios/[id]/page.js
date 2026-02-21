// src/app/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const id = String(params?.id || "");
  const service = await prisma.service.findUnique({
    where: { id },
    select: { title: true, description: true },
  });
  if (!service) return { title: "Servicio no encontrado" };
  return {
    title: `${service.title} | Salud Mental`,
    description: (service.description || "").substring(0, 160),
  };
}

export default async function ServiceDetailPage({ params }) {
  const id = String(params?.id || "");
  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      durationMin: true,
      professionalAssignments: {
        where: {
          status: "APPROVED",
          professional: {
            is: {
              isApproved: true,
              user: { is: { isActive: true } },
            },
          },
        },
        select: {
          professional: {
            select: {
              id: true,
              specialty: true,
              bio: true,
              user: { select: { name: true, image: true } },
            },
          },
        },
      },
    },
  });

  if (!service) notFound();

  const pros = (service.professionalAssignments || []).map((a) => a.professional);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <Link href="/servicios" className="text-sm text-slate-600 hover:underline">
        ← Volver a Servicios
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{service.title}</h1>
        <div className="text-sm text-slate-700 mt-3">
          ⏱ {service.durationMin} min · ₡{Number(service.price)}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">Descripción</h2>
        <p className="text-slate-700 mt-3">
          {service.description || "No hay descripción disponible para este servicio."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">Profesionales disponibles</h2>

        {pros.length === 0 ? (
          <p className="mt-3 text-slate-700">Actualmente no hay profesionales asignados a este servicio.</p>
        ) : (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {pros.map((pro) => (
              <div key={pro.id} className="rounded-xl border border-slate-200 p-4">
                <div className="font-semibold text-slate-900">{pro.user?.name}</div>
                <div className="text-sm text-slate-600">{pro.specialty || "Profesional de Salud"}</div>
                {pro.bio && <p className="text-sm text-slate-700 mt-3">{pro.bio}</p>}

                <Link
                  href={`/panel/paciente/agendar?serviceId=${service.id}&professionalId=${pro.id}`}
                  className="inline-block mt-4 rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
                >
                  Agendar cita
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}