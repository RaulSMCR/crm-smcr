import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionError } from "@/lib/prisma-safe";

export const metadata = {
  title: "Servicios | Salud Mental Costa Rica",
  description: "Explora nuestros servicios de terapia, coaching y asesoria.",
};

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  let services = [];
  let dbUnavailable = false;

  try {
    services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        bannerImage: true,
        bannerFocusX: true,
        bannerFocusY: true,
        bannerScale: true,
        bannerArtworkTitle: true,
        bannerArtworkAuthor: true,
        bannerArtworkNote: true,
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
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    dbUnavailable = true;
    console.error("No se pudo cargar /servicios por falla de conexion a la base:", error);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Nuestros Servicios</h1>
        <p className="mt-2 text-slate-600">Encuentra el apoyo profesional que necesitas hoy.</p>
      </div>

      {dbUnavailable ? (
        <div className="rounded-2xl border border-accent-300 bg-accent-50 p-6">
          <h2 className="text-xl font-bold text-brand-950">Servicios temporalmente no disponibles</h2>
          <p className="mt-2 text-neutral-900">
            No pudimos conectarnos a la base de datos en este momento. Intenta nuevamente en unos minutos.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {services.map((service) => {
          const professionals = (service.professionalAssignments || []).map(
            (assignment) => assignment.professional
          );
          const minApprovedPrice = (service.professionalAssignments || []).reduce((min, assignment) => {
            const current = Number(assignment?.approvedSessionPrice);
            if (!Number.isFinite(current)) return min;
            return min === null ? current : Math.min(min, current);
          }, null);

          const priceLabel = Number.isFinite(minApprovedPrice)
            ? `Desde CRC ${minApprovedPrice.toLocaleString("es-CR")}`
            : "Precio segun profesional";

          return (
            <div key={service.id} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative h-56 bg-slate-200">
                {service.bannerImage ? (
                  <img
                    src={service.bannerImage}
                    alt={service.title}
                    className="h-full w-full object-cover transition-transform duration-500"
                    style={{
                      objectPosition: `${service.bannerFocusX ?? 50}% ${service.bannerFocusY ?? 50}%`,
                      transform: `scale(${(service.bannerScale ?? 100) / 100})`,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-end bg-gradient-to-br from-slate-200 via-slate-100 to-white p-6">
                    <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700">
                      Servicio destacado
                    </span>
                  </div>
                )}

                {service.bannerArtworkTitle || service.bannerArtworkAuthor || service.bannerArtworkNote ? (
                  <div className="absolute left-4 top-4 max-w-sm rounded-2xl border border-white/10 bg-brand-950/92 p-4 text-white opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                    <div className="mb-2 inline-flex rounded-full bg-accent-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-50">
                      Obra destacada
                    </div>
                    {service.bannerArtworkTitle ? (
                      <div className="text-sm font-semibold text-neutral-50">{service.bannerArtworkTitle}</div>
                    ) : null}
                    {service.bannerArtworkAuthor ? (
                      <div className="text-xs text-neutral-100/90">{service.bannerArtworkAuthor}</div>
                    ) : null}
                    {service.bannerArtworkNote ? (
                      <p className="mt-2 line-clamp-3 max-w-xl text-xs leading-relaxed text-neutral-100/90">
                        {service.bannerArtworkNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="image-overlay-strong absolute inset-x-0 bottom-0 p-6">
                  <h2 className="contrast-on-image text-xl font-bold">{service.title}</h2>
                  <div className="contrast-on-image-muted mt-2 text-sm">
                    {priceLabel} · {service.durationMin} min
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="min-w-0 flex-1">
                  <p className="text-justify text-slate-600">
                    {service.description || "Sin descripcion disponible."}
                  </p>
                </div>

                <Link
                  href={`/servicios/${service.id}`}
                  className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 sm:w-auto"
                >
                  Ver detalles
                </Link>
              </div>

              {professionals.length > 0 ? (
                <div className="border-t border-slate-100 px-6 pb-6 pt-5">
                  <div className="text-sm font-semibold text-slate-800">Disponible con:</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {professionals.map((professional) => (
                      <Link
                        key={professional.id}
                        href={`/agendar/${professional.id}?serviceId=${service.id}`}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        {professional.user?.image ? (
                          <img
                            src={professional.user.image}
                            alt={professional.user.name || "Profesional"}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {(professional.user?.name || "P").charAt(0)}
                          </div>
                        )}
                        <span className="text-sm text-slate-700">{professional.user?.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!dbUnavailable && services.length === 0 ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
          <p className="text-neutral-900">Todavia no hay servicios publicados.</p>
        </div>
      ) : null}
    </div>
  );
}
