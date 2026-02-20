// src/app/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }) {
  const service = await prisma.service.findUnique({
    where: { id: params.id },
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
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <Link href="/servicios" className="text-sm text-slate-600 hover:text-slate-900">
        ← Volver a Servicios
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-900">{service.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-slate-700">
          <span>⏱ {service.durationMin} min</span>
          <span className="font-semibold">${Number(service.price)}</span>
        </div>
        <p className="mt-4 text-slate-700">
          {service.description || "No hay descripción disponible para este servicio."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900">Profesionales Disponibles</h2>

        {pros.length > 0 ? (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {pros.map((pro) => (
              <div key={pro.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                    {pro.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pro.user.image} alt={pro.user.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-700">
                        {pro.user.name?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{pro.user.name}</div>
                    <div className="text-sm text-slate-600">{pro.specialty || "Profesional"}</div>
                  </div>
                </div>

                {pro.bio && <p className="mt-3 text-sm text-slate-700">{pro.bio}</p>}

                <div className="mt-4">
                  <Link
                    href={`/panel/paciente/agendar?serviceId=${service.id}&professionalId=${pro.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700"
                  >
                    Agendar Cita
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Actualmente no hay profesionales asignados a este servicio.
          </div>
        )}
      </div>
    </div>
  );
}
