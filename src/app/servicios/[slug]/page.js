import { prisma } from "@/lib/prisma";
import { notFound, permanentRedirect } from "next/navigation";
import { resolveRedirect, TIPOS } from "@/lib/slug-redirect";
import Link from "next/link";
import { isPrismaConnectionError, fallarSiEsBuild } from "@/lib/prisma-safe";
import ViewTracker from "@/components/tracking/ViewTracker";
import JsonLd from "@/components/JsonLd";
import { siteUrl } from "@/lib/site-url";
import { resolveSeo, buildMetadata } from "@/lib/seo";
import { grafo, ref, nodoMigas, idServicio, ID_ORGANIZACION } from "@/lib/jsonld";
import SafeImage, { SafeAvatar } from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";
import { TARIFA_VIGENTE, rangoDePrecios, rangosPorServicio, etiquetaDeRango } from "@/lib/service-pricing";

export const revalidate = 3600;

/** Prerenderiza los servicios activos. Ver la nota en blog/[slug]. */
export async function generateStaticParams() {
  const servicios = await prisma.service.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return servicios.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug || "");
  let service = null;

  try {
    service = await prisma.service.findUnique({
      where: { slug },
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
    path: `servicios/${slug}`,
    image: seo.image,
    imageAlt: seo.imageAlt,
    noindex: seo.noindex,
  });
}

export default async function ServiceDetailPage({ params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug || "");
  let service = null;
  let dbUnavailable = false;

  try {
    service = await prisma.service.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
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
            rates: { some: TARIFA_VIGENTE },
            professional: {
              is: {
                isApproved: true,
                user: { is: { isActive: true } },
              },
            },
          },
          select: {
            rates: { where: TARIFA_VIGENTE, select: { approvedPrice: true } },
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
    fallarSiEsBuild(error, `/servicios/${slug}`);
    dbUnavailable = true;
    console.error(`No se pudo cargar /servicios/${slug} por falla de conexion a la base:`, error);
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

  if (!service) {
    // Hoy el segmento es el cuid del servicio; en S6 pasa a ser un slug legible
    // y las URLs con cuid quedan registradas acá como origen.
    const vigente = await resolveRedirect(TIPOS.SERVICIO, slug);
    if (vigente) permanentRedirect(`/servicios/${vigente}`);
    notFound();
  }

  const professionals = (service.professionalAssignments || []).map((assignment) => ({
    ...assignment.professional,
    rango: rangoDePrecios(assignment.rates),
  }));

  // El rango se recalcula sobre todos los profesionales del servicio, que es lo
  // que anuncia la ficha; `professionals` ya trae a todos acá, pero se usa la
  // misma agregación que el listado para que ambos digan siempre lo mismo.
  const rango = (await rangosPorServicio(prisma, [service.id])).get(service.id) || null;
  const priceLabel = etiquetaDeRango(rango);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <JsonLd
        data={grafo(
          {
            "@type": "Service",
            "@id": idServicio(service.slug),
            name: service.title,
            description: service.description || undefined,
            url: siteUrl(`servicios/${service.slug}`),
            // Quién presta el servicio. Sin esto el nodo flotaba: un servicio sin
            // proveedor no le dice a nadie de quién se está hablando.
            provider: ref(ID_ORGANIZACION),
            areaServed: { "@type": "Country", name: "Costa Rica" },
            // Un `Offer` con un solo `price` declara que ese es EL precio. Cuando
            // varios profesionales cobran distinto eso es falso, y un precio que
            // no se corresponde con lo que el usuario encuentra es motivo de
            // sanción en Merchant/rich results. `AggregateOffer` dice la verdad:
            // hay un piso, un techo y cuántas ofertas lo sostienen.
            offers: rango
              ? rango.min === rango.max
                ? {
                    "@type": "Offer",
                    priceCurrency: "CRC",
                    price: rango.min,
                    availability: "https://schema.org/InStock",
                    url: siteUrl(`servicios/${service.slug}`),
                  }
                : {
                    "@type": "AggregateOffer",
                    priceCurrency: "CRC",
                    lowPrice: rango.min,
                    highPrice: rango.max,
                    offerCount: professionals.length,
                    availability: "https://schema.org/InStock",
                    url: siteUrl(`servicios/${service.slug}`),
                  }
              : undefined,
          },
          nodoMigas([
            { nombre: "Servicios", url: siteUrl("servicios") },
            { nombre: service.title, url: siteUrl(`servicios/${service.slug}`) },
          ]),
        )}
      />
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
          // El servicio se publica aunque todavía no tenga a nadie asignado. Decir
          // "no hay profesionales" suena a que el servicio no existe; decir que se
          // está incorporando dice lo que realmente pasa y deja una puerta abierta
          // a quien quiera sumarse.
          <div className="mt-3 rounded-xl border border-accent-300 bg-accent-50 p-4">
            <p className="font-semibold text-brand-950">Estamos incorporando profesionales para este servicio.</p>
            <p className="mt-1 text-sm text-neutral-800">
              Si sos profesional en esta área y te interesa sumarte al equipo,{" "}
              <Link href="/registro/profesional" className="font-semibold text-brand-700 underline">
                escribinos
              </Link>
              . Mientras tanto, podés ver{" "}
              <Link href="/servicios" className="font-semibold text-brand-700 underline">
                los otros servicios disponibles
              </Link>
              .
            </p>
          </div>
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
                  Valor de la cita: {etiquetaDeRango(professional.rango)}
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
