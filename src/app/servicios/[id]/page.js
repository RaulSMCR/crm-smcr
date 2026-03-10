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
        select: {
          approvedSessionPrice: true,
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

  const professionals = (service.professionalAssignments || []).map((assignment) => ({
    ...assignment.professional,
    approvedSessionPrice: assignment.approvedSessionPrice,
  }));

  const minApprovedPrice = (service.professionalAssignments || []).reduce((min, assignment) => {
    const current = Number(assignment?.approvedSessionPrice);
    if (!Number.isFinite(current)) return min;
    return min === null ? current : Math.min(min, current);
  }, null);

  const priceLabel = Number.isFinite(minApprovedPrice)
    ? `Desde CRC ${minApprovedPrice.toLocaleString("es-CR")}`
    : "Precio segun profesional";

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <Link href="/servicios" className="text-sm text-slate-600 hover:underline">
        ← Volver a Servicios
      </Link>

      <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative h-72 bg-slate-200 md:h-80">
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
            <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-white" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-transparent" />
          {service.bannerArtworkTitle || service.bannerArtworkAuthor || service.bannerArtworkNote ? (
            <div className="absolute right-4 top-4 max-w-md rounded-2xl border border-white/10 bg-brand-950/90 p-5 text-white opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
              <div className="mb-2 inline-flex rounded-full bg-accent-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                Obra destacada
              </div>
              {service.bannerArtworkTitle ? (
                <div className="text-sm font-semibold text-white">{service.bannerArtworkTitle}</div>
              ) : null}
              {service.bannerArtworkAuthor ? (
                <div className="text-xs text-white/75">{service.bannerArtworkAuthor}</div>
              ) : null}
              {service.bannerArtworkNote ? (
                <p className="mt-2 text-xs leading-relaxed text-white/80">{service.bannerArtworkNote}</p>
              ) : null}
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <h1 className="text-3xl font-bold text-white md:text-4xl">{service.title}</h1>
            <div className="mt-3 text-sm text-slate-100">
              {service.durationMin} min · {priceLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Descripcion</h2>
        <p className="mt-3 text-justify text-slate-700">
          {service.description || "No hay descripcion disponible para este servicio."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Profesionales disponibles</h2>

        {professionals.length === 0 ? (
          <p className="mt-3 text-slate-700">Actualmente no hay profesionales asignados a este servicio.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {professionals.map((professional) => (
              <div key={professional.id} className="rounded-xl border border-slate-200 p-4">
                <Link
                  href={`/agendar/${professional.id}?serviceId=${service.id}`}
                  className="inline-flex items-center gap-3 rounded-lg p-1 transition hover:bg-blue-50"
                >
                  {professional.user?.image ? (
                    <img
                      src={professional.user.image}
                      alt={professional.user?.name || "Profesional"}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                      {(professional.user?.name || "P").charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">{professional.user?.name}</div>
                    <div className="text-sm text-slate-600">
                      {professional.specialty || "Profesional de Salud"}
                    </div>
                  </div>
                </Link>

                {professional.bio ? (
                  <p className="mt-3 text-justify text-sm text-slate-700">{professional.bio}</p>
                ) : null}
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Valor de la cita: CRC {Number(professional.approvedSessionPrice).toLocaleString("es-CR")}
                </p>

                <Link
                  href={`/agendar/${professional.id}?serviceId=${service.id}`}
                  className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
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
