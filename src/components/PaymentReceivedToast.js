"use client";

// Aviso al paciente de que su pago se acreditó.
//
// Se consulta al montar el panel del paciente: el pago ocurre fuera de la app
// —en el checkout de ONVO, desde el correo— así que el aviso tiene que esperarlo
// hasta que vuelva a entrar. La acción del servidor los marca como vistos al
// entregarlos, de modo que no reaparecen en cada carga.

import { useEffect, useState } from "react";
import { consumirAvisosDePago } from "@/actions/payment-notice-actions";
import { modalityLabel } from "@/lib/rates";

function formatCRC(monto, moneda = "CRC") {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(Number(monto));
}

function formatFecha(iso) {
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

export default function PaymentReceivedToast() {
  const [avisos, setAvisos] = useState([]);

  useEffect(() => {
    let cancelado = false;
    consumirAvisosDePago()
      .then((res) => {
        if (!cancelado) setAvisos(res?.avisos || []);
      })
      .catch(() => {
        // Un aviso perdido no justifica romperle el panel al paciente.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (avisos.length === 0) return null;

  const cerrar = (id) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-3">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-emerald-700 bg-emerald-900 p-5 text-white shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">Pago recibido</h3>
            <button
              type="button"
              onClick={() => cerrar(aviso.id)}
              aria-label="Cerrar aviso"
              className="-mt-1 rounded-lg px-2 text-lg leading-none text-white/80 transition-opacity hover:opacity-100"
            >
              ×
            </button>
          </div>

          <p className="mt-2 text-sm">
            Recibimos su <b>{aviso.etiqueta}</b> de{" "}
            <b>{formatCRC(aviso.monto, aviso.moneda)}</b>.
          </p>

          {aviso.cita && (
            <dl className="mt-3 space-y-1 text-sm">
              <div>
                <dt className="text-white/70">Cita</dt>
                <dd className="font-medium">
                  {aviso.cita.servicio}
                  {aviso.cita.profesional ? ` con ${aviso.cita.profesional}` : ""}
                </dd>
                <dd>{formatFecha(aviso.cita.fecha)}</dd>
              </div>
              {aviso.cita.lugar && (
                <div>
                  <dt className="text-white/70">Lugar</dt>
                  <dd>
                    {aviso.cita.lugar}
                    {aviso.cita.modalidad ? ` (${modalityLabel(aviso.cita.modalidad)})` : ""}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <p className="mt-3 text-xs text-white/80">
            {aviso.quedaSaldo
              ? "Su cita quedó agendada. El saldo restante se cobra al concluir la consulta."
              : "Su cita quedó saldada. Le enviamos la factura electrónica por correo."}
          </p>
        </div>
      ))}
    </div>
  );
}
