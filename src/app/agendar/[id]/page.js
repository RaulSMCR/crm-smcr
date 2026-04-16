import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BookingInterface from '@/components/booking/BookingInterface';
import JsonLd from '@/components/JsonLd';
import ViewTracker from '@/components/tracking/ViewTracker';

export async function generateMetadata({ params }) {
  const canonical = `https://saludmentalcostarica.com/agendar/${params.id}`;
  const professional = await prisma.professionalProfile.findUnique({
    where: { id: params.id },
    select: {
      specialty: true,
      bio: true,
      avatarUrl: true,
      user: { select: { name: true } },
    },
  });

  if (!professional) return { title: 'Profesional no encontrado' };

  const name = professional.user?.name || 'Profesional';
  const description = (
    professional.bio ||
    `Agendá una consulta con ${name}, especialista en ${professional.specialty}.`
  ).substring(0, 160);
  const ogImage = professional.avatarUrl
    ? [{ url: professional.avatarUrl, width: 800, height: 800, alt: name }]
    : [{ url: '/og-image.png', width: 1200, height: 630, alt: name }];

  return {
    title: `Agendá con ${name} — ${professional.specialty}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Agendá con ${name} | Salud Mental Costa Rica`,
      description,
      url: canonical,
      images: ogImage,
    },
  };
}

export default async function AgendarPage({ params, searchParams }) {
  const { id } = params;
  const preSelectedServiceId = searchParams?.serviceId;

  const professional = await prisma.professionalProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
      serviceAssignments: {
        where: { status: 'APPROVED', approvedSessionPrice: { not: null } },
        orderBy: [{ service: { displayOrder: 'asc' } }, { service: { title: 'asc' } }],
        select: {
          approvedSessionPrice: true,
          service: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!professional) {
    return notFound();
  }

  const services = professional.serviceAssignments
    .map((assignment) => {
      if (!assignment.service) return null;

      const approvedPrice = Number(assignment.approvedSessionPrice);
      if (!Number.isFinite(approvedPrice) || approvedPrice <= 0) return null;

      return {
        ...assignment.service,
        displayPrice: approvedPrice,
      };
    })
    .filter(Boolean);

  if (services.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-2xl font-bold text-slate-900">Agenda no disponible</h1>
          <p className="mt-3 text-slate-700">
            Este profesional no tiene valores de consulta aprobados para servicios agendables en este momento.
          </p>
        </div>
      </div>
    );
  }

  let selectedService = null;

  if (preSelectedServiceId) {
    selectedService = services.find((service) => service.id === preSelectedServiceId);
  }

  const activeService = selectedService || services[0];

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': ['Person', 'MedicalBusiness'],
    name: professional.user.name,
    description: professional.bio || undefined,
    image: professional.avatarUrl || professional.user.image || undefined,
    url: `https://saludmentalcostarica.com/agendar/${professional.id}`,
    jobTitle: professional.specialty,
    ...(professional.licenseNumber && { identifier: professional.licenseNumber }),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Servicios disponibles',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.title,
        },
        priceCurrency: 'CRC',
        price: s.displayPrice,
      })),
    },
  };

  const professionalName = professional.user.name;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <JsonLd data={personSchema} />
      <ViewTracker
        eventName="view_professional"
        eventParams={{ professional_name: professionalName }}
        contentName={professionalName}
        contentCategory="profesional"
      />
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-12">
        <div className="space-y-6 md:col-span-5 lg:col-span-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-gray-200 shadow-md">
              {professional.user.image ? (
                <img
                  src={professional.user.image}
                  alt={professional.user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-gray-400">
                  {professional.user.name.charAt(0)}
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{professional.user.name}</h1>
            <p className="font-medium text-blue-600">{professional.specialty || 'Profesional de Salud'}</p>

            {professional.bio && (
              <p className="mt-4 text-sm leading-relaxed text-gray-500">{professional.bio}</p>
            )}
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-brand-900">
              Reserva segura
            </h4>
            <ul className="space-y-2 text-sm text-neutral-900">
              <li>Confirmacion inmediata</li>
              <li>Recordatorios por email</li>
              <li>
                Cancelacion sin costo hasta 24 horas antes de la cita
                <p className="mt-1 text-xs text-brand-900">
                  Si cancelas dentro de las 24 horas previas, se puede cobrar un 50% del valor real de la consulta aprobado para este profesional.
                </p>
              </li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-7 lg:col-span-8">
          <BookingInterface
            professionalId={professional.id}
            servicePrice={Number(activeService.displayPrice)}
            serviceTitle={activeService.title}
            serviceId={activeService.id}
            professionalName={professionalName}
          />
        </div>
      </div>
    </div>
  );
}
