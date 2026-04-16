import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isPrismaConnectionError } from "@/lib/prisma-safe";
import ViewTracker from "@/components/tracking/ViewTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const id = String(params?.id || "");
  const canonical = `https://saludmentalcostarica.com/servicios/${id}`;
  let service = null;

  try {
    service = await prisma.service.findUnique({
      where: { id },
      select: { title: true, description: true, bannerImage: true },
    });
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    return {
      title: "Servicio temporalmente no disponible",
      description: "No pudimos acceder a la información del servicio en este momento.",
    };
  }

  if (!service) return { title: "Servicio no encontrado" };

  const description = (service.description || "").substring(0, 160);
  const ogImage = service.bannerImage
    ? [{ url: service.bannerImage, width: 1200, height: 630, alt: service.title }]
    : [{ url: "/og-image.png", width: 1200, height: 630, alt: service.title }];

  return {
    title: service.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${service.title} | Salud Mental Costa Rica`,
      description,
      url: canonical,
      images: ogImage,
    },
  };
}

export default async function ServiceDetailPage({ params }) {
  const id = String(params?.id || "");
  let service = null;
  let dbUnavailable = false;

  try {
    service = await prisma.service.findUnique({
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
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    dbUnavailable = true;
    console.error(`No se pudo cargar /servicios/${id} por falla de conexion a la base:`, error);
  }

  if (dbUnavailable) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
        <Link href="/servicios" className="text-sm text-slate-600 hover:underline">
          Volver a Servicios
        </Link>
        <div className="rounded-2xl border border-accent-300 bg-accent-50 p-6">
          <h1 className="text-2xl font-bold text-brand-950">Servicio temporalmente no disponible</h1>
          <p className="mt-2 text-neutral-900">
            No pudimos conectarnos a la base de datos para cargar este servicio. Intenta nuevamente en unos minutos.
          </p>
        </div>
      </div>
    );
  }

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
      <ViewTracker
        eventName="view_service"
        eventParams={{ service_name: service.title }}
        contentName={service.title}
        contentCategory="servicio"
      />
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
          <div className="image-overlay-strong absolute inset-0" />
          {service.bannerArtworkTitle || service.bannerArtworkAuthor || service.bannerArtworkNote ? (
            <div className="absolute right-4 top-4 max-w-md rounded-2xl border border-white/10 bg-brand-950/92 p-5 text-white opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
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
                <p className="mt-2 text-xs leading-relaxed text-neutral-100/90">{service.bannerArtworkNote}</p>
              ) : null}
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
            <h1 className="contrast-on-image text-3xl font-bold md:text-4xl">{service.title}</h1>
            <div className="contrast-on-image-muted mt-3 text-sm">
              {service.durationMin} min · {priceLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Descripción</h2>
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
                  className="inline-flex items-center gap-3 rounded-lg p-1 transition hover:bg-brand-50"
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
