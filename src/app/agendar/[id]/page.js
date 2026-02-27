// src/app/agendar/[id]/page.js
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import BookingInterface from "@/components/booking/BookingInterface";

// Nota: params y searchParams son inyectados por Next.js automáticamente
export default async function AgendarPage({ params, searchParams }) {
  const { id } = params;

  // Normaliza serviceId (puede venir como string o array)
  const preSelectedServiceId = Array.isArray(searchParams?.serviceId)
    ? searchParams.serviceId[0]
    : searchParams?.serviceId;

  // 1. Buscamos al profesional usando la tabla 'professionalProfile'
  const professional = await prisma.professionalProfile.findUnique({
    where: { id }, // El ID en la URL corresponde al perfil profesional
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
      serviceAssignments: {
        where: { status: "APPROVED" },
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

  const services = (professional.serviceAssignments || [])
    .map((assignment) => {
      if (!assignment?.service) return null;

      const approved = assignment.approvedSessionPrice != null
        ? Number(assignment.approvedSessionPrice)
        : NaN;

      const base = assignment.service.price != null
        ? Number(assignment.service.price)
        : NaN;

      const finalPrice = Number.isFinite(approved)
        ? approved
        : Number.isFinite(base)
          ? base
          : 0;

      return {
        ...assignment.service,
        // Unificamos el naming para la lógica de booking…
        bookingPrice: finalPrice,
        // …y mantenemos compatibilidad con UI/branch que use displayPrice
        displayPrice: finalPrice,
      };
    })
    .filter(Boolean);

  // 2. Lógica para determinar el servicio activo (por defecto el primero o el seleccionado)
  let selectedService = null;

  if (preSelectedServiceId) {
    selectedService = services.find((s) => s.id === preSelectedServiceId) || null;
  }

  const activeService =
    selectedService ||
    services[0] || {
      id: null,
      title: "Consulta General",
      price: 50,
      bookingPrice: 50,
      displayPrice: 50,
    };

  const activePrice = Number(
    activeService.bookingPrice ??
      activeService.displayPrice ??
      activeService.price ??
      0
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* COLUMNA IZQUIERDA: Perfil del Profesional */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-32 h-32 mx-auto rounded-full bg-gray-200 mb-4 overflow-hidden border-4 border-white shadow-md">
              {/* Renderizamos la imagen del usuario (antes avatarUrl) */}
              {professional.user.image ? (
                <img
                  src={professional.user.image}
                  alt={professional.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 font-bold">
                  {professional.user.name?.charAt(0)}
                </div>
              )}
            </div>

            {/* Renderizamos el nombre del usuario */}
            <h1 className="text-2xl font-bold text-gray-900">
              {professional.user.name}
            </h1>
            <p className="text-blue-600 font-medium">
              {professional.specialty || "Profesional de Salud"}
            </p>

            {professional.bio && (
              <p className="text-gray-500 text-sm mt-4 leading-relaxed">
                {professional.bio}
              </p>
            )}
          </div>

          {/* Tarjeta de Garantía / Confianza */}
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <h4 className="font-semibold text-accent-600 mb-2 flex items-center gap-2">
              🛡️ Reserva Segura
            </h4>
            <ul className="text-sm text-accent-600 space-y-2">
              <li>✓ Confirmación inmediata</li>
              <li>✓ Recordatorios por email</li>
              <li>
                ✓ Cancelación sin costo hasta 24 horas antes de la cita
                <p className="text-xs text-white mt-1">
                  Se debe tener en cuenta que en caso de cancelación dentro de
                  las 24 horas anteriores a la cita se cobrará un 50% del valor
                  de la consulta.
                </p>
              </li>
            </ul>
          </div>
        </div>

        {/* COLUMNA DERECHA: Interfaz de Calendario */}
        <div className="md:col-span-7 lg:col-span-8">
          <BookingInterface
            professionalId={professional.id}
            servicePrice={activePrice}
            serviceTitle={activeService.title}
            serviceId={activeService.id}
          />
        </div>
      </div>
    </div>
  );
}
