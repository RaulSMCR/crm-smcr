import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isPrismaConnectionError } from "@/lib/prisma-safe";
import ViewTracker from "@/components/tracking/ViewTracker";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/site-url";
import { resolveSeo, buildMetadata } from "@/lib/seo";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { id: rawId } = await params;
  const id = String(rawId || "");
  let service = null;

  try {
    service = await prisma.service.findUnique({
      where: { id },
      select: {
        title: true, description: true, bannerImage: true,
        metaTitle: true, metaDescription: true, ogImage: true, noindex: true,
      },
    });
  } catch (error) {
    if (!isPrismaConnectionError(error)) throw error;
    return {
      title: "Servicio temporalmente no disponible",
      description: "No pudimos acceder a la información del servicio en este momento.",
    };
  }

  if (!service) return { title: "Servicio no encontrado" };

  const seo = resolveSeo(service, {
    title: service.title,
    description: service.description || "",
    image: service.bannerImage,
    imageAlt: service.title,
  });

  return buildMetadata({
    title: seo.title,
    description: seo.description,
    path: `servicios/${id}`,
    image: seo.image,
    imageAlt: seo.imageAlt,
    noindex: seo.noindex,
  });
}

export default async function ServiceDetailPage({ params }) {
  const { id: rawId } = await params;
  const id = String(rawId || "");
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
                slug: true,
                specialty: true,
                bio: true,
                profileReview: true,
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
          <h1 className="text-3xl font-light text-brand-950">Servicio temporalmente no disponible</h1>
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
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Servicios", item: siteUrl("servicios") }, { "@type": "ListItem", position: 2, name: service.title, item: siteUrl(`servicios/${service.id}`) }] }} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: service.title, description: service.description || undefined, offers: minApprovedPrice !== null ? { "@type": "Offer", priceCurrency: "CRC", price: minApprovedPrice, availability: "https://schema.org/InStock" } : undefined }} />
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
            <SafeImage
              src={service.bannerImage}
              alt={service.title}
              fallbackSrc={IMAGE_FALLBACKS.service}
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
          <div className="absolute inset-x-0 bottom-0 p-6 transition-opacity duration-300 group-hover:opacity-0 md:p-8">
            <h1 className="contrast-on-image text-4xl font-light md:text-5xl">{service.title}</h1>
            <div className="contrast-on-image-muted mt-3 text-sm">
              {service.durationMin} min · {priceLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-semibold text-slate-900">Descripción</h2>
        <p className="mt-3 text-justify text-slate-700">
          {service.description || "No hay descripción disponible para este servicio."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-semibold text-slate-900">Profesionales disponibles</h2>

        {professionals.length === 0 ? (
          <p className="mt-3 text-slate-700">Actualmente no hay profesionales asignados a este servicio.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {professionals.map((professional) => (
              <div key={professional.id} className="rounded-xl border border-slate-200 p-4">
                <Link
                  href={professional.slug ? `/profesionales/${professional.slug}?serviceId=${service.id}` : `/agendar/${professional.id}?serviceId=${service.id}`}
                  className="inline-flex items-center gap-3 rounded-lg p-1 transition hover:bg-brand-50"
                >
                  {professional.user?.image ? (
                    <SafeAvatar
                      src={professional.user.image}
                      name={professional.user?.name || "Profesional"}
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

                {professional.profileReview ? (
                  <p className="mt-3 text-justify text-sm text-slate-700">
                    {professional.profileReview}
                  </p>
                ) : null}
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  Valor de la cita: CRC {Number(professional.approvedSessionPrice).toLocaleString("es-CR")}
                </p>

                <Link
                  href={`/agendar/${professional.id}?serviceId=${service.id}`}
                  className="btn btn-accent mt-4"
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
