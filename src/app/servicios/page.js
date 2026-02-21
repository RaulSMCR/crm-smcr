// src/app/servicios/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const servicesRaw = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      durationMin: true,
      professionals: {
        where: {
          isApproved: true,
          user: { is: { isActive: true } },
        },
        take: 5,
        select: {
          id: true,
          specialty: true,
          user: { select: { name: true, image: true } },
        },
      },
    },
  });

  const services = servicesRaw.map((s) => ({
    ...s,
    // ✅ evita cualquier rareza con Decimal
    price: s.price?.toString?.() ?? String(s.price),
    professionalAssignments: (s.professionals || []).map((p) => ({ professional: p })),
  }));

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Servicios</h1>
          <p className="text-slate-600 mt-2">Elige un servicio y un profesional disponible.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{s.title}</h2>
                {s.description ? (
                  <p className="text-slate-600 mt-2">{s.description}</p>
                ) : (
                  <p className="text-slate-500 mt-2">Sin descripción.</p>
                )}
                <div className="text-sm text-slate-700 mt-3">
                  <b>Duración:</b> {s.durationMin} min · <b>Precio:</b> ₡{s.price}
                </div>
              </div>

              <Link
                href={`/servicios/${s.id}`}
                className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 whitespace-nowrap"
              >
                Ver detalles
              </Link>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-slate-800">Profesionales destacados</div>

              {s.professionalAssignments.length === 0 ? (
                <p className="text-sm text-slate-600 mt-2">
                  Aún no hay profesionales aprobados para este servicio.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {s.professionalAssignments.map(({ professional }) => (
                    <div
                      key={professional.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <div className="text-sm text-slate-800">
                        <b>{professional.user?.name}</b> · {professional.specialty}
                      </div>

                      <Link
                        href={`/panel/paciente/agendar?serviceId=${s.id}&professionalId=${professional.id}`}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Agendar
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}