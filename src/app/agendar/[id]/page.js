//src/app/agendar/[id]/page.js
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BookingInterface from '@/components/booking/BookingInterface';

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
        where: { status: 'APPROVED' },
        orderBy: [{ service: { displayOrder: "asc" } }, { service: { title: "asc" } }],
        select: {
          approvedSessionPrice: true,
          service: {
            select: { id: true, title: true, price: true },
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
      const basePrice = Number(assignment.service.price);

      return {
        ...assignment.service,
        displayPrice: Number.isFinite(approvedPrice) ? approvedPrice : basePrice,
      };
    })
    .filter(Boolean);

  let selectedService = null;

  if (preSelectedServiceId) {
    selectedService = services.find((service) => service.id === preSelectedServiceId);
  }

  const activeService = selectedService || services[0] || {
    id: null,
    title: 'Consulta General',
    displayPrice: 50,
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
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

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-accent-600">
              Reserva Segura
            </h4>
            <ul className="space-y-2 text-sm text-accent-600">
              <li>Confirmación inmediata</li>
              <li>Recordatorios por email</li>
              <li>
                Cancelación sin costo hasta 24 horas antes de la cita
                <p className="mt-1 text-xs text-white">
                  Se debe tener en cuenta que en caso de cancelación dentro de las 24 horas anteriores a la cita se cobrará un 50% del valor de la consulta.
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
          />
        </div>
      </div>
    </div>
  );
}
