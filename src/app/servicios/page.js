// src/app/servicios/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Servicios | Salud Mental Costa Rica",
  description: "Explora nuestros servicios de terapia, coaching y asesoría.",
};

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      durationMin: true,
      professionalAssignments: {
        where: {
          status: "APPROVED",
          approvedSessionPrice: { not: null },
          professional: {
            is: {
              isApproved: true,
              user: { is: { isActive: true } },
            },
          },
        },
        take: 5,
        select: {
          approvedSessionPrice: true,
          professional: {
            select: {
              id: true,
              specialty: true,
              user: { select: { name: true, image: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Nuestros Servicios</h1>
        <p className="mt-2 text-slate-600">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {services.map((service) => {
          const professionals = (service.professionalAssignments || []).map((assignment) => assignment.professional);
          const minApprovedPrice = (service.professionalAssignments || []).reduce((min, assignment) => {
            const current = Number(assignment?.approvedSessionPrice);
            if (!Number.isFinite(current)) return min;
            return min === null ? current : Math.min(min, current);
          }, null);

          const priceLabel = Number.isFinite(minApprovedPrice)
            ? `Desde ₡${minApprovedPrice.toLocaleString("es-CR")}`
            : "Precio según profesional";

          return (
            <div key={service.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{service.title}</h2>
                  <p className="mt-2 text-slate-600">
                    {service.description || "Sin descripción disponible."}
                  </p>
                  <div className="mt-3 text-sm text-slate-700">
                    {priceLabel} · {service.durationMin} min
                  </div>
                </div>

                <Link
                  href={`/servicios/${service.id}`}
                  className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  Ver detalles
                </Link>
              </div>

              {professionals.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-slate-800">Disponible con:</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {professionals.map((professional) => (
                      <div
                        key={professional.id}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1"
                      >
                        {professional.user?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={professional.user.image}
                            alt={professional.user.name || "Profesional"}
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {(professional.user?.name || "P").charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-slate-700">{professional.user?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
