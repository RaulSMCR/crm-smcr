import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cargarAgendaReservable } from "@/lib/booking-availability";
import { getSession } from "@/actions/auth-actions";
import ProfessionalCalendarBooking from "@/components/booking/ProfessionalCalendarBooking";
import { SELECT_TARIFA_PUBLICA, TARIFA_VIGENTE, rangoDePrecios, etiquetaDeRango } from "@/lib/service-pricing";

export const dynamic = "force-dynamic";

export default async function PacienteAgendarPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "USER") redirect("/panel");

  // Next 16: `searchParams` es una Promise; sin `await` ambos quedaban vacíos
  // y todo intento de agendar rebotaba a /servicios.
  const params = await searchParams;
  const professionalId = String(params?.professionalId ?? "");
  const serviceId = String(params?.serviceId ?? "");
  if (!professionalId || !serviceId) redirect("/servicios");

  // Ventana holgada: buildSlots ofrece 14 días por defecto, pero los modales de
  // reprogramación miran más lejos. Traer de más acá es una consulta indexada.
  const blockWindowFrom = new Date();
  const blockWindowTo = new Date(blockWindowFrom.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [service, professional, assignment, agenda] = await Promise.all([
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, slug: true, title: true, durationMin: true, isActive: true },
    }),
    prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        slug: true,
        specialty: true,
        isApproved: true,
        user: { select: { name: true, image: true, isActive: true } },
      },
    }),
    prisma.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId, serviceId } },
      select: {
        status: true,
        // La tarifa definitiva la resuelve la cascada al confirmar, según el
        // lugar y la hora que elija el paciente. Acá solo se necesita saber si
        // hay alguna vigente —si no, no hay nada que cobrar— y qué rango
        // anunciarle antes de que elija.
        rates: { where: TARIFA_VIGENTE, select: SELECT_TARIFA_PUBLICA },
      },
    }),
    // Semana tipo, citas tomadas, bloqueos y Google Calendar. Lo ocupado llega
    // sin títulos: esto se le pasa a un componente de cliente, y el título de un
    // evento de Google del profesional no puede terminar en el navegador de un
    // paciente.
    cargarAgendaReservable({ professionalId, from: blockWindowFrom, to: blockWindowTo }),
  ]);

  if (!service?.isActive) redirect("/servicios");
  if (!professional?.isApproved || !professional.user?.isActive) redirect("/servicios");

  const rango = rangoDePrecios(assignment?.rates);

  if (!assignment || assignment.status !== "APPROVED" || !rango) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-bold text-slate-900">Agenda no disponible</h1>
        <p className="mt-2 text-slate-700">
          Este profesional aún no está habilitado para agendar en este servicio.
        </p>
        <div className="mt-4">
          <a className="text-brand-800 hover:text-brand-900 hover:underline" href={`/servicios/${service.slug}`}>
            Volver al servicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <div>
        <div className="text-sm text-slate-600">
          <a className="hover:underline" href={`/servicios/${service.slug}`}>
            Volver al servicio
          </a>
        </div>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">Agendar cita</h1>
        <p className="mt-1 text-slate-600">
          Servicio: <b>{service.title}</b> · Duración: <b>{service.durationMin} min</b> · Tarifa aprobada:{" "}
          <b>{etiquetaDeRango(rango)}</b>
        </p>
      </div>

      <ProfessionalCalendarBooking
        serviceId={service.id}
        professionalId={professional.id}
        professionalName={professional.user?.name || "Profesional"}
        professionalImage={professional.user?.image || null}
        professionalSlug={professional.slug || null}
        durationMin={service.durationMin}
        availability={agenda.availability}
        booked={agenda.booked}
        warnings={agenda.warnings}
      />
    </div>
  );
}
