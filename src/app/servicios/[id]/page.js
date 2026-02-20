// src/app/servicios/[id]/page.js
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { id } = params;
  const service = await prisma.service.findUnique({
    where: { id },
    select: { title: true, description: true },
  });
  if (!service) return { title: "Servicio no encontrado" };

  return {
    title: `${service.title} | Salud Mental`,
    description: service.description?.substring(0, 160),
  };
}

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({ params }) {
  const { id } = params;

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
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <Link href="/servicios" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
        ← Volver a Servicios
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h1 className="text-3xl font-bold text-slate-800">{service.title}</h1>
        <div className="mt-2 text-slate-700">
          ⏱ {service.durationMin} min · <span className="font-semibold">${Number(service.price)}</span>
        </div>

        <h3 className="mt-6 text-lg font-semibold text-slate-800">Descripción</h3>
        <p className="mt-2 text-slate-600">
          {service.description || "No hay descripción disponible para este servicio."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-800">Profesionales Disponibles</h2>

        {pros.length > 0 ? (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {pros.map((pro) => (
              <div key={pro.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                    {pro.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pro.user.image} alt={pro.user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-slate-600">{pro.user.name?.charAt(0)}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{pro.user.name}</div>
                    <div className="text-sm text-slate-500">{pro.specialty || "Profesional de Salud"}</div>
                  </div>
                </div>

                {pro.bio && <p className="mt-3 text-sm text-slate-600 line-clamp-4">{pro.bio}</p>}

                <div className="mt-4">
                  {/* Mantengo el CTA sin asumir tu ruta exacta de agenda */}
                  <Link
                    href={`/panel/paciente?serviceId=${service.id}&professionalId=${pro.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
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
