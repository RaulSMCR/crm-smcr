"use client";

import { DEFAULT_TZ } from "@/lib/timezone";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Toast from "@/components/ui/Toast";
import CancelAppointmentModal from "./appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "./appointments/RescheduleAppointmentModal";
import {
  cancelAppointmentByPatient,
  confirmCurrentAppointmentByPatient,
} from "@/actions/patient-booking-actions";

const CANCELLED_STATUSES = new Set(["CANCELLED_BY_USER", "CANCELLED_BY_PRO"]);

const formatDateInTZ = (date) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));

const formatTimeInTZ = (date) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

function getStatusBadge(status) {
  const config = {
    PENDING: { label: "Pendiente", style: "bg-amber-500 text-white border-amber-500" },
    CONFIRMED: { label: "Confirmada", style: "bg-green-600 text-white border-green-600" },
    CANCELLED_BY_USER: { label: "Cancelada", style: "bg-red-600 text-white border-red-600" },
    CANCELLED_BY_PRO: {
      label: "Cancelada por profesional",
      style: "bg-red-600 text-white border-red-600",
    },
    COMPLETED: { label: "Completada", style: "bg-slate-600 text-white border-slate-600" },
    NO_SHOW: { label: "Ausente", style: "bg-purple-600 text-white border-purple-600" },
  };

  const current = config[status] || { label: status, style: "bg-gray-100" };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${current.style}`}>
      {current.label}
    </span>
  );
}

function EmptySection({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      No hay citas en {title.toLowerCase()}.
    </div>
  );
}

function SectionHeader({ title, count, description }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
        {count}
      </span>
    </div>
  );
}

export default function UserAppointmentsPanel({
  initialAppointments = [],
  initialAction = "",
  initialActionAppointmentId = "",
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);
  const [isApplyingAction, startActionTransition] = useTransition();
  const router = useRouter();
  const handledIntentRef = useRef(false);

  useEffect(() => {
    if (handledIntentRef.current) return;
    if (!initialAction || !initialActionAppointmentId) return;

    handledIntentRef.current = true;

    const targetAppointment = initialAppointments.find(
      (item) => item.id === initialActionAppointmentId
    );
    if (!targetAppointment) {
      setToast({ message: "No se encontro la cita del enlace recibido.", type: "error" });
      router.replace("/panel/paciente");
      return;
    }

    if (initialAction === "reschedule") {
      setReschedulingApt(targetAppointment);
      setToast({ message: "Seleccione un nuevo horario para continuar con su cuidado.", type: "success" });
      router.replace("/panel/paciente");
      return;
    }

    if (initialAction === "confirm") {
      startActionTransition(async () => {
        const result = await confirmCurrentAppointmentByPatient(initialActionAppointmentId);
        if (result?.success) {
          setAppointments((prev) =>
            prev.map((item) =>
              item.id === initialActionAppointmentId ? { ...item, status: "CONFIRMED" } : item
            )
          );
          setToast({ message: "Horario confirmado. Avisamos al profesional para continuar con la serie.", type: "success" });
        } else {
          setToast({ message: result?.error || "No se pudo confirmar el horario.", type: "error" });
        }
        router.replace("/panel/paciente");
      });
    }
  }, [initialAction, initialActionAppointmentId, initialAppointments, router]);


  async function handleCancel(appointmentId, reason) {
    const result = await cancelAppointmentByPatient(appointmentId, reason);
    if (result?.success) {
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId ? { ...item, status: "CANCELLED_BY_USER" } : item
        )
      );
      setToast({ message: "Cita cancelada correctamente.", type: "success" });
    } else {
      setToast({ message: result?.error || "No se pudo cancelar la cita.", type: "error" });
    }
    return result;
  }

  const sections = useMemo(() => {
    const now = Date.now();

    const cancelled = [];
    const unpaid = [];
    const reschedule = [];
    const future = [];
    const paid = [];

    for (const appointment of appointments) {
      const dateValue = new Date(appointment.date).getTime();
      const isFuture = dateValue > now;
      const isCancelled = CANCELLED_STATUSES.has(appointment.status);
      const isPaid = appointment.paymentStatus === "PAID";
      const isConfirmedFuture = appointment.status === "CONFIRMED" && isFuture;
      const isPendingFuture = appointment.status === "PENDING" && isFuture;
      const isPastOrCompleted = appointment.status === "COMPLETED" || dateValue <= now;

      if (isCancelled) {
        cancelled.push(appointment);
        continue;
      }

      if (!isPaid && isPastOrCompleted) {
        unpaid.push(appointment);
        continue;
      }

      if (isConfirmedFuture) {
        reschedule.push(appointment);
        continue;
      }

      if (isPendingFuture) {
        future.push(appointment);
        continue;
      }

      if (isPaid) {
        paid.push(appointment);
      }
    }

    return { future, cancelled, unpaid, reschedule, paid };
  }, [appointments]);

  const renderAppointment = (appointment) => {
    return (
      <div
        key={appointment.id}
        className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50 sm:flex-row"
      >
        <div className="flex gap-4">
          <Link
            href={`/agendar/${appointment.professionalId}${
              appointment.serviceId ? `?serviceId=${appointment.serviceId}` : ""
            }`}
            className="flex-shrink-0 rounded-full transition hover:ring-2 hover:ring-blue-200"
          >
            {appointment.professional.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={appointment.professional.user.image}
                alt={appointment.professional.user?.name}
                className="h-12 w-12 rounded-full border object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                {appointment.professional.user?.name?.charAt(0) ?? "?"}
              </div>
            )}
          </Link>

          <div>
            <Link
              href={`/agendar/${appointment.professionalId}${
                appointment.serviceId ? `?serviceId=${appointment.serviceId}` : ""
              }`}
              className="font-semibold text-gray-900 hover:text-blue-700"
            >
              {appointment.professional.user?.name}
            </Link>
            <p className="text-sm text-gray-500">
              {appointment.service?.title || "Consulta General"}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {formatDateInTZ(appointment.date)}
              </div>
              <div className="flex items-center gap-1">
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {formatTimeInTZ(appointment.date)} hs
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {getStatusBadge(appointment.status)}

          {appointment.pricePaid ? (
            <span className="text-sm font-medium text-gray-900">
              ₡{Number(appointment.pricePaid).toLocaleString("es-CR")}
            </span>
          ) : null}

          {appointment.status === "COMPLETED" && appointment.paymentStatus !== "PAID" ? (
            (() => {
              const tx = appointment.paymentTransactions?.[0];
              const onvoLinkId = tx?.onvoPaymentLinkId;
              const payUrl = onvoLinkId
                ? `https://checkout.onvopay.com/pay/${onvoLinkId}`
                : null;
              return (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {payUrl ? (
                    <>
                      <p className="font-semibold">Pago pendiente</p>
                      <p className="mt-1 text-xs text-amber-700">
                        Se le envió un enlace de pago al correo. También puede pagar directamente:
                      </p>
                      <a
                        href={payUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block w-full rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Pagar ahora
                      </a>
                    </>
                  ) : (
                    <p>Pago pendiente — revise su correo electrónico para el enlace de pago.</p>
                  )}
                </div>
              );
            })()
          ) : null}

          {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
          new Date(appointment.date) > new Date() ? (
            <>
              {appointment.status === "CONFIRMED" ? (
                <button
                  onClick={() => setReschedulingApt(appointment)}
                  className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Reagendar
                </button>
              ) : (
                <button
                  onClick={() =>
                    startActionTransition(async () => {
                      const result = await confirmCurrentAppointmentByPatient(appointment.id);
                      if (result?.success) {
                        setAppointments((prev) =>
                          prev.map((item) =>
                            item.id === appointment.id
                              ? { ...item, status: "CONFIRMED" }
                              : item
                          )
                        );
                        setToast({ message: "Cita confirmada. El profesional ha sido notificado.", type: "success" });
                      } else {
                        setToast({ message: result?.error || "No se pudo confirmar la cita.", type: "error" });
                      }
                    })
                  }
                  disabled={isApplyingAction}
                  className="mt-2 w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                >
                  {isApplyingAction ? "Confirmando..." : "Confirmar cita"}
                </button>
              )}

              <button
                onClick={() => setCancelingApt(appointment)}
                className="mt-2 w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Cancelar cita
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {isApplyingAction ? (
        <div className="rounded-xl border border-brand-300 bg-brand-100 px-4 py-3 text-sm text-neutral-900">
          Registrando su confirmacion para continuar con seguridad...
        </div>
      ) : null}

      <section>
        <SectionHeader
          title="Citas futuras"
          count={sections.future.length}
          description="Citas pendientes de confirmacion o por realizar."
        />
        <div className="space-y-4">
          {sections.future.length > 0 ? sections.future.map(renderAppointment) : <EmptySection title="Citas futuras" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Citas para reagendar"
          count={sections.reschedule.length}
          description="Citas confirmadas que aun pueden mover de horario."
        />
        <div className="space-y-4">
          {sections.reschedule.length > 0 ? sections.reschedule.map(renderAppointment) : <EmptySection title="Citas para reagendar" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Citas sin pagar"
          count={sections.unpaid.length}
          description="Citas finalizadas o vencidas con saldo pendiente."
        />
        <div className="space-y-4">
          {sections.unpaid.length > 0 ? sections.unpaid.map(renderAppointment) : <EmptySection title="Citas sin pagar" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Citas pagadas"
          count={sections.paid.length}
          description="Citas con pago registrado correctamente."
        />
        <div className="space-y-4">
          {sections.paid.length > 0 ? sections.paid.map(renderAppointment) : <EmptySection title="Citas pagadas" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Citas canceladas"
          count={sections.cancelled.length}
          description="Historial de citas anuladas por usted o por el profesional."
        />
        <div className="space-y-4">
          {sections.cancelled.length > 0 ? sections.cancelled.map(renderAppointment) : <EmptySection title="Citas canceladas" />}
        </div>
      </section>

      <div className="border-t border-gray-100 bg-white pt-4">
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/servicios"
            className="rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white transition-colors hover:bg-blue-700"
          >
            Explorar servicios
          </Link>
          <Link
            href="/blog"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-center font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Seguir aprendiendo
          </Link>
        </div>
      </div>

      {reschedulingApt ? (
        <RescheduleAppointmentModal
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
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

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
