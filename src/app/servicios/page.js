//src/app/servicios/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Servicios | Salud Mental Costa Rica",
  description: "Explora nuestros servicios de terapia, coaching y asesoría.",
};

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const services = await prisma.service.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      professionalAssignments: {
        where: {
          status: "APPROVED",
          professional: { isApproved: true, user: { isActive: true } },
        },
        take: 5,
        select: {
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
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Nuestros Servicios</h1>
        <p className="text-slate-600 mt-2">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {services.map((service) => {
          const pros = (service.professionalAssignments || []).map((a) => a.professional);

          return (
            <div key={service.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{service.title}</h2>
                  <p className="text-slate-600 mt-1">
                    {service.description || "Sin descripción disponible."}
                  </p>
                </div>
                <div className="text-sm text-slate-700 whitespace-nowrap">
                  ${Number(service.price)}
                </div>
              </div>

              {pros.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-slate-600">Disponible con:</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pros.map((pro) => (
                      <div
                        key={pro.id}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1"
                      >
                        <div className="h-7 w-7 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                          {pro.user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pro.user.image} alt={pro.user.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-slate-700">
                              {pro.user.name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-800">{pro.user.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <Link
                  href={`/servicios/${service.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
                >
                  Ver Detalles
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
