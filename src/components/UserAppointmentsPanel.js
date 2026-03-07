"use client";

import { DEFAULT_TZ } from "@/lib/timezone";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CancelAppointmentModal from "./appointments/CancelAppointmentModal";
import RescheduleAppointmentModal from "./appointments/RescheduleAppointmentModal";
import {
  cancelAppointmentByPatient,
  confirmCurrentAppointmentByPatient,
} from "@/actions/patient-booking-actions";
import { initiateBalancePayment } from "@/actions/payment-actions";

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

export default function UserAppointmentsPanel({
  initialAppointments = [],
  initialAction = "",
  initialActionAppointmentId = "",
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [filter, setFilter] = useState("ALL");
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [isApplyingAction, startActionTransition] = useTransition();
  const [payingAptId, setPayingAptId] = useState(null);
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
      setActionMessage("No se encontro la cita del enlace recibido.");
      router.replace("/panel/paciente");
      return;
    }

    if (initialAction === "reschedule") {
      setReschedulingApt(targetAppointment);
      setActionMessage("Excelente avance. Seleccione un nuevo horario para continuar con su cuidado.");
      router.replace("/panel/paciente");
      return;
    }

    if (initialAction === "confirm") {
      startActionTransition(async () => {
        const result = await confirmCurrentAppointmentByPatient(initialActionAppointmentId);
        if (result?.success) {
          setActionMessage(
            "Horario confirmado. Avisamos al profesional para continuar con la serie."
          );
        } else {
          setActionMessage(result?.error || "No se pudo confirmar el horario.");
        }
        router.replace("/panel/paciente");
      });
    }
  }, [initialAction, initialActionAppointmentId, initialAppointments, router]);

  async function handlePay(apt) {
    // Si ya hay URL generada (auto-creada al completar), redirigir directo
    const existingUrl = apt.paymentTransactions?.[0]?.p2pProcessUrl;
    if (existingUrl) {
      window.location.href = existingUrl;
      return;
    }
    setPayingAptId(apt.id);
    const result = await initiateBalancePayment(apt.id);
    setPayingAptId(null);
    if (result?.success && result.processUrl) {
      window.location.href = result.processUrl;
    } else {
      setActionMessage(
        result?.error ||
          "No fue posible iniciar el pago en este intento. Por favor, intÃ©ntelo nuevamente para continuar de forma segura."
      );
    }
  }

  async function handleCancel(appointmentId, reason) {
    const result = await cancelAppointmentByPatient(appointmentId, reason);
    if (result?.success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: "CANCELLED_BY_USER" } : a))
      );
    }
    return result;
  }

  const getStatusBadge = (status) => {
    const config = {
      PENDING: { label: "Pendiente", style: "bg-amber-500 text-white border-amber-500" },
      CONFIRMED: { label: "Confirmada", style: "bg-green-600 text-white border-green-600" },
      CANCELLED_BY_USER: { label: "Cancelada", style: "bg-red-600 text-white border-red-600" },
      CANCELLED_BY_PRO: {
        label: "Cancelada por Prof.",
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
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === "ALL") return true;
    const isPast = new Date(apt.date) < new Date();
    return filter === "PAST" ? isPast : !isPast;
  });

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col items-center justify-between gap-4 border-b border-gray-100 p-6 sm:flex-row">
        <h2 className="text-xl font-bold text-gray-800">Mis Citas</h2>
        <div className="rounded-lg bg-gray-100 p-1">
          {["ALL", "UPCOMING", "PAST"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                filter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              {f === "ALL" ? "Todas" : f === "UPCOMING" ? "Proximas" : "Historial"}
            </button>
          ))}
        </div>
      </div>

      {actionMessage && (
        <div className="mx-6 mt-4 rounded-xl border border-brand-300 bg-brand-100 px-4 py-3 text-sm text-neutral-900">
          {actionMessage}
        </div>
      )}

      {isApplyingAction && (
        <div className="mx-6 mt-4 rounded-xl border border-brand-300 bg-brand-100 px-4 py-3 text-sm text-neutral-900">
          Registrando su confirmacion para continuar con seguridad...
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filteredAppointments.length > 0 ? (
          filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              className="flex flex-col justify-between gap-4 p-6 transition-colors hover:bg-gray-50 sm:flex-row"
            >
              <div className="flex gap-4">
                <Link
                  href={`/agendar/${apt.professionalId}${apt.serviceId ? `?serviceId=${apt.serviceId}` : ""}`}
                  className="flex-shrink-0 rounded-full transition hover:ring-2 hover:ring-blue-200"
                >
                  {apt.professional.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={apt.professional.user.image}
                      alt={apt.professional.user?.name}
                      className="h-12 w-12 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                      {apt.professional.user?.name?.charAt(0) ?? "?"}
                    </div>
                  )}
                </Link>

                <div>
                  <Link
                    href={`/agendar/${apt.professionalId}${apt.serviceId ? `?serviceId=${apt.serviceId}` : ""}`}
                    className="font-semibold text-gray-900 hover:text-blue-700"
                  >
                    {apt.professional.user?.name}
                  </Link>
                  <p className="text-sm text-gray-500">{apt.service?.title || "Consulta General"}</p>

                  <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDateInTZ(apt.date)}
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTimeInTZ(apt.date)} hs
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(apt.status)}

                {apt.service?.price && (
                  <span className="text-sm font-medium text-gray-900">
                    ${Number(apt.service.price).toLocaleString("es-AR")}
                  </span>
                )}

                {apt.status === "COMPLETED" && apt.paymentStatus !== "PAID" && (
                  <button
                    onClick={() => handlePay(apt)}
                    disabled={payingAptId === apt.id}
                    className="mt-2 w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {payingAptId === apt.id ? "Procesando..." : "Pagar"}
                  </button>
                )}

                {(apt.status === "PENDING" || apt.status === "CONFIRMED") &&
                  new Date(apt.date) > new Date() && (
                    <>
                      {apt.status === "CONFIRMED" ? (
                        <button
                          onClick={() => setReschedulingApt(apt)}
                          className="mt-2 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                          Reagendar
                        </button>
                      ) : (
                        <div className="mt-2 w-full cursor-default rounded-xl bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-white">
                          Pendiente de confirmacion
                        </div>
                      )}
                      <button
                        onClick={() => setCancelingApt(apt)}
                        className="mt-2 w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                      >
                        Cancelar cita
                      </button>
                    </>
                  )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No hay citas en esta lista</h3>
            <p className="mx-auto mt-1 max-w-sm text-gray-500">
              {filter === "ALL"
                ? "Aun no se registran citas agendadas. Cuando lo desee, podra avanzar con una nueva atencion profesional."
                : "No se encontraron citas que coincidan con este filtro."}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 bg-white p-6">
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

      {reschedulingApt && (
        <RescheduleAppointmentModal
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
        />
      )}

      {cancelingApt && (
        <CancelAppointmentModal
          appointment={cancelingApt}
          onCancel={handleCancel}
          onClose={() => setCancelingApt(null)}
          role="patient"
        />
      )}
    </div>
  );
}

