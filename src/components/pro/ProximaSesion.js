"use client";

// La «Próxima sesión» en la app: el mismo modal del panel, ya armado con el
// paciente, el servicio y el horario de la semana siguiente. Se abre cuando la
// página llega con ?proxima=<id> y, al cerrarlo, se vuelve a /pro.
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import CreateProfessionalAppointmentModal from "@/components/appointments/CreateProfessionalAppointmentModal";

export default function ProximaSesion({ bookingContext, previousAppointment }) {
  const router = useRouter();
  const { avisar } = useToast();
  const volver = () => router.replace("/pro", { scroll: false });

  return (
    <CreateProfessionalAppointmentModal
      patients={bookingContext.patients}
      services={bookingContext.services}
      availability={bookingContext.availability}
      booked={bookingContext.booked}
      professionalSlug={bookingContext.professionalSlug}
      previousAppointment={previousAppointment}
      onClose={volver}
      onSuccess={(resultado) => {
        const cuantas = Number(resultado?.createdCount || 1);
        avisar(cuantas > 1 ? `Se agendaron ${cuantas} sesiones.` : "Próxima sesión agendada.", "success");
        volver();
      }}
    />
  );
}
