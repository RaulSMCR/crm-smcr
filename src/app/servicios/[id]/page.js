// src/app/servicios/[id]/page.js
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServicioDetallePage({ params }) {
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
      professionals: {
        where: {
          isApproved: true,
          user: { is: { isActive: true } },
        },
        select: {
          id: true,
          specialty: true,
          bio: true,
          user: { select: { name: true, image: true } },
        },
        take: 50,
      },
    },
  });

  if (!service || !service.isActive) notFound();

  const priceStr = service.price?.toString?.() ?? String(service.price);

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-sm text-slate-600">
            <Link href="/servicios" className="hover:underline">
              ← Volver a servicios
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mt-2">{service.title}</h1>

          <div className="text-sm text-slate-700 mt-3">
            <b>Duración:</b> {service.durationMin} min · <b>Precio:</b> ₡{priceStr}
          </div>

          {service.description ? (
            <p className="text-slate-700 mt-4">{service.description}</p>
          ) : (
            <p className="text-slate-500 mt-4">Sin descripción.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900">Profesionales disponibles</h2>
        <p className="text-slate-600 mt-1 text-sm">
          Solo se muestran profesionales aprobados y activos.
        </p>

        {service.professionals.length === 0 ? (
          <p className="mt-4 text-slate-700">
            Aún no hay profesionales aprobados para este servicio.
          </p>
        ) : (
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            {service.professionals.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{p.user?.name || "Profesional"}</div>
                    <div className="text-sm text-slate-600">{p.specialty}</div>

                    {p.bio ? (
                      <p className="text-sm text-slate-700 mt-3 line-clamp-4">{p.bio}</p>
                    ) : (
                      <p className="text-sm text-slate-500 mt-3">Sin biografía.</p>
                    )}
                  </div>

                  <Link
                    href={`/panel/paciente/agendar?serviceId=${service.id}&professionalId=${p.id}`}
                    className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-semibold hover:bg-blue-700 whitespace-nowrap"
                  >
                    Agendar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}