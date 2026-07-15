import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import ViewTracker from "@/components/tracking/ViewTracker";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

function formatCRC(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Precio no disponible";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getProfessional(slug) {
  return prisma.professionalProfile.findFirst({
    where: {
      slug,
      isApproved: true,
      user: { is: { isActive: true } },
    },
    select: {
      id: true,
      slug: true,
      specialty: true,
      licenseNumber: true,
      bio: true,
      profileReview: true,
      rating: true,
      user: { select: { name: true, image: true } },
      serviceAssignments: {
        where: {
          status: "APPROVED",
          approvedSessionPrice: { not: null },
          service: { is: { isActive: true } },
        },
        orderBy: [{ service: { displayOrder: "asc" } }, { service: { title: "asc" } }],
        select: {
          approvedSessionPrice: true,
          service: { select: { id: true, title: true, description: true, durationMin: true } },
        },
      },
      posts: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, title: true, slug: true, excerpt: true },
      },
    },
  });
}

export async function generateMetadata({ params }) {
  const slug = String(params?.slug || "");
  const professional = await getProfessional(slug);
  if (!professional) return { title: "Profesional no encontrado" };

  const name = professional.user?.name || "Profesional";
  const description = (
    professional.profileReview ||
    `${name}, especialista en ${professional.specialty || "salud mental"} en Salud Mental Costa Rica.`
  ).slice(0, 160);
  const image = professional.user?.image
    ? [{ url: professional.user.image, width: 800, height: 800, alt: name }]
    : [{ url: "/og-image.png", width: 1200, height: 630, alt: name }];

  return {
    title: `${name} | Perfil profesional`,
    description,
    alternates: { canonical: `https://saludmentalcostarica.com/profesionales/${professional.slug}` },
    openGraph: {
      title: `${name} | Salud Mental Costa Rica`,
      description,
      url: `https://saludmentalcostarica.com/profesionales/${professional.slug}`,
      images: image,
    },
  };
}

export default async function ProfessionalPublicProfilePage({ params, searchParams }) {
  const slug = String(params?.slug || "");
  const professional = await getProfessional(slug);
  if (!professional) notFound();

  const name = professional.user?.name || "Profesional";
  const review = professional.profileReview || "";
  const services = professional.serviceAssignments
    .map((assignment) => ({
      ...assignment.service,
      price: Number(assignment.approvedSessionPrice),
    }))
    .filter((service) => service?.id);
  const requestedServiceId = String(searchParams?.serviceId || "");
  const firstService = services.find((service) => service.id === requestedServiceId) || services[0];

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    description: review || undefined,
    image: professional.user?.image || undefined,
    url: `https://saludmentalcostarica.com/profesionales/${professional.slug}`,
    jobTitle: professional.specialty || undefined,
    ...(professional.licenseNumber ? { identifier: professional.licenseNumber } : {}),
  };

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      <JsonLd data={personSchema} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Profesionales", item: "https://saludmentalcostarica.com/profesionales" }, { "@type": "ListItem", position: 2, name, item: `https://saludmentalcostarica.com/profesionales/${professional.slug}` }] }} />
      <ViewTracker
        eventName="view_professional_profile"
        eventParams={{ professional_name: name }}
        contentName={name}
        contentCategory="perfil-profesional"
      />

      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/nosotros" className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline">
          Volver al equipo
        </Link>

        <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mx-auto h-44 w-44 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {professional.user?.image ? (
                <img src={professional.user.image} alt={name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-5xl font-bold text-slate-500">
                  {name.charAt(0)}
                </div>
              )}
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-2xl font-bold text-slate-950">{name}</h1>
              <p className="mt-1 text-sm font-semibold text-brand-800">
                {professional.specialty || "Profesional de salud"}
              </p>
              {professional.licenseNumber ? (
                <p className="mt-2 text-xs text-slate-600">Licencia: {professional.licenseNumber}</p>
              ) : null}
            </div>

            {firstService ? (
              <Link
                href={`/agendar/${professional.id}?serviceId=${firstService.id}`}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800"
              >
                Agendar cita
              </Link>
            ) : (
              <Link
                href="/servicios"
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white hover:bg-brand-800"
              >
                Ver servicios
              </Link>
            )}
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="text-xl font-bold text-slate-950">Resena profesional</h2>
              {review ? (
                <p className="mt-4 whitespace-pre-line text-justify leading-7 text-slate-700">{review}</p>
              ) : (
                <p className="mt-4 text-slate-700">
                  Este profesional esta preparando su resena publica. Mientras tanto, puede revisar sus servicios disponibles.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <h2 className="text-xl font-bold text-slate-950">Servicios disponibles</h2>
              {services.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="font-semibold text-slate-950">{service.title}</div>
                      <p className="mt-1 line-clamp-3 text-sm text-slate-600">
                        {service.description || "Servicio disponible para agendar."}
                      </p>
                      <div className="mt-3 text-sm font-semibold text-emerald-800">
                        {formatCRC(service.price)} - {service.durationMin} min
                      </div>
                      <Link
                        href={`/agendar/${professional.id}?serviceId=${service.id}`}
                        className="mt-4 inline-flex rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                      >
                        Agendar este servicio
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-slate-700">No hay servicios agendables publicados para este profesional.</p>
              )}
            </section>

            {professional.posts.length > 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <h2 className="text-xl font-bold text-slate-950">Articulos publicados</h2>
                <div className="mt-4 grid gap-3">
                  {professional.posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="rounded-xl border border-slate-200 p-4 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <div className="font-semibold text-slate-950">{post.title}</div>
                      {post.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.excerpt}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
