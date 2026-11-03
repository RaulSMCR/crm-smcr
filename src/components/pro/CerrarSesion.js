"use client";

// Completar o marcar ausente una sesión desde la app. Usa la misma acción que
// el panel (updateAppointmentStatus), así que el cobro del saldo, la multa y los
// avisos salen igual que allá.
//
// Al completar se pasa a /pro?proxima=<id>: la página abre ahí la «Próxima
// sesión». Va por la URL y no por un estado de este botón porque, una vez
// completada, la cita deja de estar en «Por cerrar» y este componente desaparece.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { updateAppointmentStatus } from "@/actions/agenda-actions";

const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

export default function CerrarSesion({ citaId, paciente }) {
  const router = useRouter();
  const { avisar } = useToast();
  const [enCurso, setEnCurso] = useState(null);

  async function cambiar(estado) {
    const pregunta =
      estado === "COMPLETED"
        ? `¿Completar la sesión con ${paciente}? Si queda saldo, el paciente recibe el enlace de pago.`
        : `¿Marcar a ${paciente} como ausente? Se le cobra el 50 % de la sesión (salvo que el adelanto ya lo cubra) y su agenda queda en pausa hasta que la administración lo contacte.`;
    if (!window.confirm(pregunta)) return;

    setEnCurso(estado);
    try {
      const resultado = await updateAppointmentStatus(citaId, estado);
      if (!resultado?.success) {
        avisar(resultado?.error || "No se pudo actualizar la sesión.", "error");
        return;
      }
      if (estado === "COMPLETED") {
        avisar("Sesión completada.", "success");
        router.replace(`/pro?proxima=${citaId}`, { scroll: false });
      } else {
        avisar("Sesión marcada como ausente.", "success");
        router.refresh();
      }
    } catch (fallo) {
      avisar(String(fallo?.message || "").trim() || "No se pudo actualizar la sesión.", "error");
    } finally {
      setEnCurso(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => cambiar("COMPLETED")}
        disabled={enCurso !== null}
        className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}
      >
        {enCurso === "COMPLETED" ? "Completando…" : "Completar"}
      </button>
      <button
        type="button"
        onClick={() => cambiar("NO_SHOW")}
        disabled={enCurso !== null}
        className={`${BOTON} border border-accent-300 text-accent-800 hover:bg-accent-50`}
      >
        {enCurso === "NO_SHOW" ? "Marcando…" : "Ausente"}
      </button>
    </>
  );
}
