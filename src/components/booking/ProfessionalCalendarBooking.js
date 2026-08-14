"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createAppointmentForPatient,
  getSlotOptionsForPatient,
} from "@/actions/patient-booking-actions";
import { buildSlots } from "@/lib/appointment-slots";
import { RECURRENCE_RULES } from "@/lib/appointment-recurrence";
import RecurrenceFields from "@/components/appointments/RecurrenceFields";
import BookingConfirmationToast from "@/components/booking/BookingConfirmationToast";
import { SafeAvatar } from "@/components/SafeImage";
import { modalityLabel } from "@/lib/rates";

function formatCRC(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function ProfessionalCalendarBooking({
  serviceId,
  professionalId,
  professionalName,
  professionalImage,
  professionalSlug,
  durationMin,
  availability,
  booked,
}) {
  const router = useRouter();
  const [selectedISO, setSelectedISO] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState(RECURRENCE_RULES.NONE);
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  // Modalidades y precios del horario elegido. Se piden al servidor porque el
  // precio depende del lugar y de la franja, no solo del servicio.
  const [options, setOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [locationId, setLocationId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [esPrimeraCita, setEsPrimeraCita] = useState(false);

  const days = useMemo(
    () => buildSlots({ availability, durationMin, booked, daysAhead: 14 }),
    [availability, durationMin, booked]
  );

  useEffect(() => {
    if (!selectedISO) {
      setOptions([]);
      setLocationId(null);
      return undefined;
    }

    let cancelled = false;
    setLoadingOptions(true);

    getSlotOptionsForPatient({ professionalId, serviceId, startISO: selectedISO })
      .then((res) => {
        if (cancelled) return;
        const list = res?.options || [];
        setOptions(list);
        setEsPrimeraCita(Boolean(res?.esPrimeraCita));
        // Con una sola opción no hay nada que elegir: se preselecciona.
        const bookable = list.filter((option) => option.bookable);
        setLocationId(bookable.length === 1 ? bookable[0].locationId : null);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedISO, professionalId, serviceId]);

  const selectedOption = options.find((option) => option.locationId === locationId) || null;
  const hasChoice = options.length > 1;
  const needsChoice = hasChoice && !selectedOption;

  const onConfirm = () => {
    if (!selectedISO || needsChoice) return;
    setMsg({ type: "", text: "" });

    startTransition(async () => {
      const res = await createAppointmentForPatient({
        professionalId,
        serviceId,
        startISO: selectedISO,
        recurrenceRule,
        recurrenceCount,
        locationId,
      });

      if (res?.success) {
        // Se muestra la confirmación un instante antes de navegar, para que el
        // paciente vea el detalle de lo que aceptó.
        setConfirmation(
          res.confirmation
            ? { ...res.confirmation, requiresDeposit: res.requiresDeposit, depositAmount: res.depositAmount }
            : null
        );
        setTimeout(() => {
          router.push(`/panel/paciente?created=1&series=${res.createdCount || 1}`);
          router.refresh();
        }, 2500);
      } else {
        setMsg({ type: "error", text: res?.error || "No pudimos agendar en este intento. Revisá el horario e intentá de nuevo." });
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
        <div className="flex items-center gap-3">
          <Link
            href={professionalSlug ? `/profesionales/${professionalSlug}${serviceId ? `?serviceId=${serviceId}` : ""}` : `/agendar/${professionalId}${serviceId ? `?serviceId=${serviceId}` : ""}`}
            className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-blue-50"
          >
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
              {professionalImage ? (
                <SafeAvatar src={professionalImage} name={professionalName} className="h-full w-full object-cover" />
              ) : (
                <span className="font-semibold text-slate-700">{professionalName?.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">{professionalName}</div>
              <div className="text-sm text-slate-600">Ver perfil</div>
            </div>
          </Link>
          <div className="text-sm text-slate-600">Seleccione un horario disponible</div>
        </div>

        {msg.text && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {msg.text}
          </div>
        )}

        {days.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay horarios disponibles en los próximos 14 días.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {days.map(({ day, slots }) => (
              <div key={day.toISOString()}>
                <div className="text-sm font-semibold text-slate-800">
                  {day.toLocaleDateString("es-CR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const iso = slot.start.toISOString();
                    const isSelected = selectedISO === iso;

                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedISO(iso)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-slate-200 text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {slot.start.toLocaleTimeString("es-CR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Confirmación</h3>

        <div className="mt-3 text-sm text-slate-700">
          Duración: <b>{durationMin} min</b>
        </div>

        <div className="mt-3 text-sm text-slate-700">
          Horario seleccionado:{" "}
          <b>{selectedISO ? new Date(selectedISO).toLocaleString("es-CR") : "—"}</b>
        </div>

        {selectedISO && (
          <div className="mt-4">
            <div className="text-sm font-medium text-slate-800">
              {hasChoice ? "¿Dónde desea ser atendido?" : "Modalidad"}
            </div>

            {loadingOptions ? (
              <p className="mt-2 text-sm text-slate-500">Consultando modalidades...</p>
            ) : options.length === 0 ? (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Este profesional aún no tiene un precio aprobado para ese horario.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {options.map((option) => {
                  const isSelected = option.locationId === locationId;

                  return (
                    <button
                      key={option.locationId || "default"}
                      type="button"
                      disabled={!option.bookable}
                      onClick={() => setLocationId(option.locationId)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                      } ${option.bookable ? "" : "cursor-not-allowed opacity-60"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{option.name}</div>
                          {option.modality && (
                            <div className="text-xs text-slate-600">{modalityLabel(option.modality)}</div>
                          )}
                          {option.address && <div className="text-xs text-slate-500">{option.address}</div>}
                        </div>
                        <div className="shrink-0 text-right">
                          {option.bookable ? (
                            <span className="font-bold text-slate-900">{formatCRC(option.price)}</span>
                          ) : (
                            <span className="text-xs text-amber-700">Sin precio aprobado</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedISO && esPrimeraCita && selectedOption?.bookable && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="font-semibold">Primera cita con este profesional</div>
            <p className="mt-1">
              Para reservarla se cobra por adelantado el <b>50%</b>, es decir{" "}
              <b>{formatCRC(Math.round(selectedOption.price / 2))}</b>. El resto se cobra al
              concluir la consulta.
            </p>
            <p className="mt-2">
              Al confirmar le enviaremos a su correo un enlace de pago seguro. La cita queda
              reservada y se le avisa acá mismo cuando registremos el pago.
            </p>
          </div>
        )}

        <RecurrenceFields
          recurrenceRule={recurrenceRule}
          recurrenceCount={recurrenceCount}
          onRuleChange={setRecurrenceRule}
          onCountChange={setRecurrenceCount}
        />

        <button
          type="button"
          disabled={!selectedISO || isPending || needsChoice || (selectedISO && options.length === 0)}
          onClick={onConfirm}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "Agendando..." : "Confirmar cita"}
        </button>

        {needsChoice && (
          <p className="mt-2 text-xs text-amber-700">Elija una modalidad para continuar.</p>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Si activas recurrencia, se crearán varias citas iguales dentro de la serie.
        </p>
      </div>

      <BookingConfirmationToast confirmation={confirmation} onDismiss={() => setConfirmation(null)} />
    </div>
  );
}

