"use client";

// Aceptar, reagendar y cancelar una cita desde la app. Abre los mismos modales
// que el panel, con las mismas acciones de servidor: lo que cambia es solo el
// lugar desde donde se toca. Tras cada cambio se refresca la página, porque las
// acciones revalidan /panel/* y no /pro/*.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { cancelAppointmentByProfessional } from "@/actions/agenda-actions";
import AcceptRecurringAppointmentModal from "@/components/appointments/AcceptRecurringAppointmentModal";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";
import ProfessionalRescheduleModal from "@/components/appointments/ProfessionalRescheduleModal";

const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors";

/**
 * @param {{ cita: { id: string, date: string, status: string, paciente: string, servicio?: string } }} props
 */
export default function AccionesDeCita({ cita }) {
  const router = useRouter();
  const { avisar } = useToast();
  const [abierto, setAbierto] = useState(null);

  // La forma que esperan los modales del panel.
  const appointment = {
    id: cita.id,
    date: cita.date,
    status: cita.status,
    user: { name: cita.paciente },
    service: { title: cita.servicio || "consulta" },
  };

  const listo = (mensaje) => {
    setAbierto(null);
    avisar(mensaje, "success");
    router.refresh();
  };

  async function cancelar(id, motivo) {
    try {
      const resultado = await cancelAppointmentByProfessional(id, motivo);
      if (resultado?.success) listo("Cita cancelada. El paciente recibe el aviso.");
      return resultado;
    } catch (fallo) {
      return { error: String(fallo?.message || "").trim() || "No se pudo cancelar la cita." };
    }
  }

  return (
    <>
      {cita.status === "PENDING" ? (
        <button type="button" onClick={() => setAbierto("aceptar")} className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}>
          Aceptar
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setAbierto("reagendar")}
        className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}
      >
        Reagendar
      </button>
      <button
        type="button"
        onClick={() => setAbierto("cancelar")}
        className={`${BOTON} border border-accent-300 text-accent-800 hover:bg-accent-50`}
      >
        Cancelar
      </button>

      {abierto === "aceptar" ? (
        <AcceptRecurringAppointmentModal
          appointment={appointment}
          onClose={() => setAbierto(null)}
          onSuccess={() => listo("Cita aceptada.")}
        />
      ) : null}
      {abierto === "reagendar" ? (
        <ProfessionalRescheduleModal
          appointment={appointment}
          onClose={() => setAbierto(null)}
          onSuccess={() => listo("Cita reagendada. El paciente recibe el aviso.")}
        />
      ) : null}
      {abierto === "cancelar" ? (
        <CancelAppointmentModal appointment={appointment} role="professional" onCancel={cancelar} onClose={() => setAbierto(null)} />
      ) : null}
    </>
  );
}
