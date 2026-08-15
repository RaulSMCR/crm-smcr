"use client";

// Confirmación de lo que el paciente acaba de reservar: fecha, hora, lugar y
// costo. Se muestra al agendar, antes de navegar, para que quede constancia en
// pantalla de las condiciones que aceptó.
//
// No usa components/ui/Toast porque aquel muestra una sola línea de texto y acá
// hay que desglosar cuatro datos, el costo entre ellos. Comparte su ubicación y
// sus atributos de accesibilidad para que se comporten igual.

import { useEffect, useState } from "react";
import { modalityLabel } from "@/lib/rates";

function formatCRC(value) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatWhen(iso) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function BookingConfirmationToast({ confirmation, onDismiss, autoHideMs = 9000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!autoHideMs) return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoHideMs);
    return () => clearTimeout(timer);
  }, [autoHideMs, onDismiss]);

  if (!confirmation || !visible) return null;

  const price = formatCRC(confirmation.price);
  const when = formatWhen(confirmation.startsAt);
  const place = confirmation.locationName;
  const modality = modalityLabel(confirmation.modality);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-brand-800 bg-brand-900 p-5 text-white shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">Cita agendada</h3>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss?.();
          }}
          aria-label="Cerrar confirmación"
          className="-mt-1 rounded-lg px-2 text-lg leading-none text-white/80 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        {when && (
          <div>
            <dt className="text-white/70">Fecha y hora</dt>
            <dd className="font-medium">
              {when}
              {confirmation.durationMin ? ` · ${confirmation.durationMin} min` : ""}
            </dd>
          </div>
        )}

        {place && (
          <div>
            <dt className="text-white/70">Lugar</dt>
            <dd className="font-medium">
              {place}
              {modality ? ` (${modality})` : ""}
            </dd>
            {confirmation.locationAddress && (
              <dd className="text-white/70">{confirmation.locationAddress}</dd>
            )}
          </div>
        )}

        {price && (
          <div>
            <dt className="text-white/70">Costo</dt>
            <dd className="text-lg font-bold">{price}</dd>
          </div>
        )}
      </dl>

      {confirmation.requiresDeposit && confirmation.depositAmount ? (
        <p className="mt-3 rounded-lg bg-white/10 p-3 text-xs">
          Te enviamos a tu correo un enlace para pagar el <b>adelanto del 50%</b> (
          {formatCRC(confirmation.depositAmount)}). La cita queda reservada; el resto se
          cobra al concluir la consulta.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-white/70">
        Este es el precio acordado al reservar y no cambia si el profesional actualiza sus tarifas.
      </p>
    </div>
  );
}
