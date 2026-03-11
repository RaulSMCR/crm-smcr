"use client";

import { useCallback, useMemo, useState } from "react";
import { isFuture } from "date-fns";
import { DEFAULT_TZ } from "@/lib/timezone";
import {
  updateAppointmentStatus,
  cancelAppointmentByProfessional,
} from "@/actions/agenda-actions";
import { cobrarCita } from "@/actions/payment-actions";
import CancelAppointmentModal from "./appointments/CancelAppointmentModal";
import ProfessionalRescheduleModal from "./appointments/ProfessionalRescheduleModal";
import CreateProfessionalAppointmentModal from "./appointments/CreateProfessionalAppointmentModal";
import AcceptRecurringAppointmentModal from "./appointments/AcceptRecurringAppointmentModal";
import FollowUpModal from "./appointments/FollowUpModal";
import Toast from "@/components/ui/Toast";

const formatTimeInTZ = (date) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const formatDateShortInTZ = (date) =>
  new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    day: "2-digit",
    month: "short",
  }).format(new Date(date));

function getStatusBadge(status) {
  const config = {
    PENDING: { label: "Pendiente", style: "bg-accent-700 text-white" },
    CONFIRMED: { label: "Confirmada", style: "bg-brand-600 text-white" },
    COMPLETED: { label: "Completada", style: "bg-brand-700 text-white" },
    NO_SHOW: { label: "Ausente", style: "bg-accent-800 text-white" },
    CANCELLED_BY_USER: {
      label: "Cancelada (P)",
      style: "bg-accent-900 text-white line-through",
    },
    CANCELLED_BY_PRO: {
      label: "Cancelada",
      style: "bg-accent-900 text-white line-through",
    },
  };
  const current = config[status] || { label: status, style: "bg-gray-100 text-gray-800" };
  return (
    <span className={`rounded px-2 py-1 text-xs font-bold ${current.style}`}>
      {current.label}
    </span>
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

function EmptySection({ title }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      No hay citas en {title.toLowerCase()}.
    </div>
  );
}

export default function ProfessionalAppointmentsPanel({
  initialAppointments = [],
  bookingContext,
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [loadingId, setLoadingId] = useState(null);
  const [cancelingApt, setCancelingApt] = useState(null);
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptingApt, setAcceptingApt] = useState(null);
  const [followUpApt, setFollowUpApt] = useState(null);
  const [cobrandoId, setCobrandoId] = useState(null);
  const [toast, setToast] = useState(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const updateAppointmentLocally = (appointmentId, changes) => {
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, ...changes } : appointment
      )
    );
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!confirm("¿Confirma el cambio de estado de esta cita?")) return;

    setLoadingId(id);
    const result = await updateAppointmentStatus(id, newStatus);

    if (result.success) {
      updateAppointmentLocally(id, { status: newStatus });
      const labels = { COMPLETED: "Cita marcada como completada.", NO_SHOW: "Cita marcada como ausente." };
      setToast({ message: labels[newStatus] || "Estado actualizado.", type: "success" });
    } else {
      setToast({ message: result.error || "Error al actualizar la cita.", type: "error" });
    }
    setLoadingId(null);
  };

  const handleCobrar = async (appointmentId) => {
    setCobrandoId(appointmentId);
    const result = await cobrarCita(appointmentId);
    setCobrandoId(null);
    if (result?.success) {
      setToast({ message: result.message || "Orden de cobro enviada al paciente.", type: "success" });
    } else {
      setToast({ message: result?.error || "No se pudo enviar el cobro.", type: "error" });
    }
  };

  const handleCancel = async (appointmentId, reason) => {
    const result = await cancelAppointmentByProfessional(appointmentId, reason);
    if (result?.success) {
      updateAppointmentLocally(appointmentId, { status: "CANCELLED_BY_PRO" });
      setToast({ message: "Cita cancelada correctamente.", type: "success" });
    } else {
      setToast({ message: result?.error || "No se pudo cancelar la cita.", type: "error" });
    }
    return result;
  };

  const sections = useMemo(() => {
    const requests = [];
    const scheduled = [];
    const toCollect = [];
    const paidCompleted = [];
    const closed = [];

    for (const appointment of appointments) {
      const future = isFuture(new Date(appointment.date));
      const cancelled =
        appointment.status === "CANCELLED_BY_USER" ||
        appointment.status === "CANCELLED_BY_PRO" ||
        appointment.status === "NO_SHOW";

      if (appointment.status === "PENDING") {
        requests.push(appointment);
        continue;
      }

      if (appointment.status === "CONFIRMED" && future) {
        scheduled.push(appointment);
        continue;
      }

      if (appointment.status === "COMPLETED" && appointment.paymentStatus !== "PAID") {
        toCollect.push(appointment);
        continue;
      }

      if (appointment.paymentStatus === "PAID" || appointment.parentAppointmentId) {
        paidCompleted.push(appointment);
        continue;
      }

      if (cancelled || appointment.status === "COMPLETED") {
        closed.push(appointment);
      }
    }

    return { requests, scheduled, toCollect, paidCompleted, closed };
  }, [appointments]);

  const renderAppointment = (appointment) => (
    <div
      key={appointment.id}
      className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50 sm:flex-row"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-gray-900">{formatTimeInTZ(appointment.date)}</p>
          <p className="text-xs text-gray-500">{formatDateShortInTZ(appointment.date)}</p>
          {getStatusBadge(appointment.status)}
          {appointment.paymentStatus === "PAID" ? (
            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
              Pagado
            </span>
          ) : null}
          {appointment.paymentStatus === "PARTIALLY_PAID" ? (
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              Deposito
            </span>
          ) : null}
          {appointment.paymentStatus === "UNPAID" && appointment.status === "COMPLETED" ? (
            <span className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
              Sin pagar
            </span>
          ) : null}
          {appointment.parentAppointmentId ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              Seguimiento
            </span>
          ) : null}
        </div>

        <p className="mt-2 font-medium text-gray-900">{appointment.user.name}</p>
        <p className="text-xs text-gray-500">{appointment.user.email}</p>
        <p className="mt-2 text-sm text-gray-800">{appointment.service?.title}</p>
        <span className="text-xs font-bold text-green-600">
          ${Number(appointment.service?.price || 0)}
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-end gap-2">
        {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
        isFuture(new Date(appointment.date)) ? (
          <button
            onClick={() => setReschedulingApt(appointment)}
            className="rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800"
          >
            Reagendar
          </button>
        ) : null}

        {appointment.status === "PENDING" ? (
          <>
            <button
              onClick={() => setAcceptingApt(appointment)}
              disabled={loadingId === appointment.id}
              className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              onClick={() => setCancelingApt(appointment)}
              disabled={loadingId === appointment.id}
              className="rounded bg-accent-700 px-3 py-1 text-xs text-white hover:bg-accent-800 disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        ) : null}

        {appointment.status === "CONFIRMED" ? (
          <>
            <button
              onClick={() => handleStatusChange(appointment.id, "COMPLETED")}
              disabled={loadingId === appointment.id}
              className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Completar
            </button>
            <button
              onClick={() => handleStatusChange(appointment.id, "NO_SHOW")}
              disabled={loadingId === appointment.id}
              className="rounded bg-accent-600 px-3 py-1 text-xs text-white hover:bg-accent-700 disabled:opacity-50"
            >
              Ausente
            </button>
            <button
              onClick={() => setCancelingApt(appointment)}
              disabled={loadingId === appointment.id}
              className="rounded bg-accent-800 px-3 py-1 text-xs text-white hover:bg-accent-900 disabled:opacity-50"
            >
              Cancelar
            </button>
          </>
        ) : null}

        {appointment.status === "COMPLETED" ? (
          <>
            {appointment.paymentStatus !== "PAID" ? (
              <button
                onClick={() => handleCobrar(appointment.id)}
                disabled={cobrandoId === appointment.id}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                title="Enviar o reenviar orden de cobro al paciente"
              >
                {cobrandoId === appointment.id ? "..." : "Cobrar"}
              </button>
            ) : null}
            <button
              onClick={() => setFollowUpApt(appointment)}
              className="rounded bg-brand-700 px-3 py-1 text-xs text-white hover:bg-brand-800"
            >
              Seguimiento
            </button>
          </>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Vista operativa organizada por el estado real del proceso de la cita.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Nueva cita
        </button>
      </div>

      <section>
        <SectionHeader
          title="Solicitudes"
          count={sections.requests.length}
          description="Citas pendientes de aceptar o rechazar."
        />
        <div className="space-y-4">
          {sections.requests.length > 0 ? sections.requests.map(renderAppointment) : <EmptySection title="Solicitudes" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Citas confirmadas"
          count={sections.scheduled.length}
          description="Citas futuras ya aceptadas y aun activas."
        />
        <div className="space-y-4">
          {sections.scheduled.length > 0 ? sections.scheduled.map(renderAppointment) : <EmptySection title="Citas confirmadas" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Por cobrar"
          count={sections.toCollect.length}
          description="Citas completadas que aun requieren orden de cobro o pago del paciente."
        />
        <div className="space-y-4">
          {sections.toCollect.length > 0 ? sections.toCollect.map(renderAppointment) : <EmptySection title="Por cobrar" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Pagadas y seguimiento"
          count={sections.paidCompleted.length}
          description="Citas cerradas con pago registrado y seguimientos generados."
        />
        <div className="space-y-4">
          {sections.paidCompleted.length > 0 ? sections.paidCompleted.map(renderAppointment) : <EmptySection title="Pagadas y seguimiento" />}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Cerradas"
          count={sections.closed.length}
          description="Canceladas, ausentes o completadas sin acciones adicionales."
        />
        <div className="space-y-4">
          {sections.closed.length > 0 ? sections.closed.map(renderAppointment) : <EmptySection title="Cerradas" />}
        </div>
      </section>

      {showCreateModal ? (
        <CreateProfessionalAppointmentModal
          patients={bookingContext?.patients || []}
          services={bookingContext?.services || []}
          availability={bookingContext?.availability || []}
          booked={bookingContext?.booked || []}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            setToast({ message: "Cita creada correctamente.", type: "success" });
          }}
        />
      ) : null}

      {reschedulingApt ? (
        <ProfessionalRescheduleModal
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
          onSuccess={(payload) => {
            updateAppointmentLocally(payload.id, {
              status: payload.status,
              date: payload.date,
            });
            setReschedulingApt(null);
            setToast({ message: "Cita reagendada correctamente.", type: "success" });
          }}
        />
      ) : null}

      {acceptingApt ? (
        <AcceptRecurringAppointmentModal
          appointment={acceptingApt}
          onClose={() => setAcceptingApt(null)}
          onSuccess={(payload) => {
            updateAppointmentLocally(payload.id, { status: payload.status });
            setAcceptingApt(null);
            setToast({ message: "Cita aceptada correctamente.", type: "success" });
          }}
        />
      ) : null}

      {cancelingApt ? (
        <CancelAppointmentModal
          appointment={cancelingApt}
          onCancel={handleCancel}
          onClose={() => setCancelingApt(null)}
          role="professional"
        />
      ) : null}

      {followUpApt ? (
        <FollowUpModal
          appointment={followUpApt}
          onClose={() => setFollowUpApt(null)}
          onSuccess={() => {
            setFollowUpApt(null);
            setToast({ message: "Cita de seguimiento agendada correctamente.", type: "success" });
            window.location.reload();
          }}
        />
      ) : null}

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </div>
  );
}
