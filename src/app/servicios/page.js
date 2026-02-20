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
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
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
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-800">Nuestros Servicios</h1>
        <p className="text-slate-600 mt-2">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((service) => {
          const pros = (service.professionalAssignments || []).map((a) => a.professional);

          return (
            <div key={service.id} className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-800">{service.title}</h2>
              <p className="text-slate-600 mt-2">
                {service.description || "Sin descripción disponible."}
              </p>

              <div className="mt-3 text-sm text-slate-700 font-semibold">
                ${Number(service.price)}
              </div>

              {pros.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-700">Disponible con:</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pros.map((pro) => (
                      <div
                        key={pro.id}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5"
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                          {pro.user.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={pro.user.image} alt={pro.user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-slate-600">
                              {pro.user.name?.charAt(0)}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-700">{pro.user.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <Link
                  href={`/servicios/${service.id}`}
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700"
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
