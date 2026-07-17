"use client";

// Lista interactiva de la Agenda (/mi/agenda). Recibe las citas ya consultadas
// por el server component y reutiliza los server actions + modales existentes
// (no duplica lógica de negocio). Tras cada acción refresca con router.refresh(),
// porque los server actions revalidan /panel/* pero no /mi/*.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CancelAppointmentModal from "@/components/appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "@/components/appointments/RescheduleAppointmentModal";
import {
  cancelAppointmentByPatient,
  confirmCurrentAppointmentByPatient,
} from "@/actions/patient-booking-actions";
import Toast from "@/components/ui/Toast";
import {
  SectionHeader,
  Card,
  Pill,
  Avatar,
  EmptyState,
  APPOINTMENT_STATUS,
  formatDateTime,
} from "@/components/mi/ui";

function CitaInfo({ cita }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar src={cita.professional?.user?.image} name={cita.professional?.user?.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-neutral-900">
          {cita.professional?.user?.name || "Profesional"}
        </p>
        {cita.professional?.specialty ? (
          <p className="text-xs text-neutral-500">{cita.professional.specialty}</p>
        ) : null}
        {cita.service?.title ? (
          <p className="mt-1 text-sm text-neutral-700">{cita.service.title}</p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-brand-700">{formatDateTime(cita.date)}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const s = APPOINTMENT_STATUS[status] || { label: status, tone: "neutral" };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export default function AgendaList({ futuras = [], anteriores = [] }) {
  const router = useRouter();
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [toast, setToast] = useState(null);
  const [showAnteriores, setShowAnteriores] = useState(false);
  const [confirming, startConfirm] = useTransition();

  // onCancel para el modal: llama al server action y refresca. El modal muestra
  // el aviso de <24 h proactivamente; además reflejamos isLateCancel de la
  // respuesta sin bloquear (tal como el flujo del panel).
  async function handleCancel(appointmentId, reason) {
    const result = await cancelAppointmentByPatient(appointmentId, reason);
    if (result?.success) {
      setToast({
        message: result.isLateCancel
          ? "Cita cancelada. Cancelaste con menos de 24 h de antelación."
          : "Cita cancelada correctamente.",
        type: "success",
      });
      router.refresh();
    }
    return result; // el modal muestra result.error si lo hay
  }

  function handleConfirm(appointmentId) {
    startConfirm(async () => {
      const result = await confirmCurrentAppointmentByPatient(appointmentId);
      if (result?.success) {
        setToast({ message: "Cita confirmada. El profesional fue notificado.", type: "success" });
        router.refresh();
      } else {
        setToast({ message: result?.error || "No se pudo confirmar la cita.", type: "error" });
      }
    });
  }

  const agendarCta = (
    <Link
      href="/servicios"
      className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
    >
      Agendar
    </Link>
  );

  return (
    <section>
      <SectionHeader title="Agenda" subtitle="Tus citas próximas y anteriores." right={agendarCta} />

      {futuras.length === 0 && anteriores.length === 0 ? (
        <EmptyState
          title="Todavía no tenés citas"
          message="Cuando agendes una consulta, aparecerá acá."
        />
      ) : (
        <div className="space-y-6">
          {/* ── Próximas ── */}
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Próximas
            </h2>
            {futuras.length > 0 ? (
              <div className="space-y-3">
                {futuras.map((cita) => (
                  <Card key={cita.id} className="border-brand-200 ring-1 ring-brand-100">
                    <div className="flex items-start justify-between gap-2">
                      <CitaInfo cita={cita} />
                      <StatusPill status={cita.status} />
                    </div>

                    {cita.meetLink ? (
                      <a
                        href={cita.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
                      >
                        Unirse a la videollamada
                      </a>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                      {cita.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => handleConfirm(cita.id)}
                          disabled={confirming}
                          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
                        >
                          {confirming ? "Confirmando…" : "Confirmar asistencia"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReschedulingApt(cita)}
                          className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
                        >
                          Reagendar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setCancelingApt(cita)}
                        className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="No tenés citas próximas" message="Agendá una consulta cuando quieras." />
            )}
          </div>

          {/* ── Anteriores (colapsable) ── */}
          {anteriores.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowAnteriores((v) => !v)}
                aria-expanded={showAnteriores}
                className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold uppercase tracking-wide text-neutral-500"
              >
                <span>Anteriores ({anteriores.length})</span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${showAnteriores ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {showAnteriores ? (
                <div className="mt-2 space-y-3">
                  {anteriores.map((cita) => (
                    <Card key={cita.id} className="opacity-80">
                      <div className="flex items-start justify-between gap-2">
                        <CitaInfo cita={cita} />
                        <StatusPill status={cita.status} />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {reschedulingApt ? (
        <RescheduleAppointmentModal
          appointment={reschedulingApt}
          onClose={() => {
            setReschedulingApt(null);
            router.refresh();
          }}
        />
      ) : null}

      {cancelingApt ? (
        <CancelAppointmentModal
          appointment={cancelingApt}
          onCancel={handleCancel}
          onClose={() => setCancelingApt(null)}
          role="patient"
        />
      ) : null}

      <Toast message={toast?.message} type={toast?.type} onDismiss={() => setToast(null)} />
    </section>
  );
}
