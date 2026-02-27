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
      price: true,
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
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Nuestros Servicios</h1>
        <p className="text-slate-600 mt-2">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((service) => {
          const pros = (service.professionalAssignments || []).map((a) => a.professional);
          const minApprovedPrice = (service.professionalAssignments || []).reduce((min, assignment) => {
            const current = Number(assignment?.approvedSessionPrice);
            if (!Number.isFinite(current)) return min;
            return min === null ? current : Math.min(min, current);
          }, null);

          const priceLabel = Number.isFinite(minApprovedPrice)
            ? `Desde ₡${minApprovedPrice}`
            : `Desde ₡${Number(service.price)}`;

          return (
            <div key={service.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{service.title}</h2>
                  <p className="text-slate-600 mt-2">
                    {service.description || "Sin descripción disponible."}
                  </p>
                  <div className="text-sm text-slate-700 mt-3">
                    {priceLabel} · {service.durationMin} min
                  </div>
                </div>

                <Link
                  href={`/servicios/${service.id}`}
                  className="rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 whitespace-nowrap"
                >
                  Ver detalles
                </Link>
              </div>

              {pros.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-slate-800">Disponible con:</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pros.map((pro) => (
                      <div key={pro.id} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1">
                        {pro.user?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pro.user.image} alt={pro.user.name || "Profesional"} className="h-6 w-6 rounded-full" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-slate-200 grid place-items-center text-xs font-bold text-slate-700">
                            {(pro.user?.name || "P").charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-slate-700">{pro.user?.name}</span>
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
