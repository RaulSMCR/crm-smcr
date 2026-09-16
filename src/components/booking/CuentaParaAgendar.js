"use client";

// src/components/booking/CuentaParaAgendar.js
//
// La pregunta que faltaba: «¿ya tenés usuario?».
//
// Para reservar hace falta una cuenta, y quien no la tenía se enteraba tarde y
// mal: elegía día, hora y modalidad, tocaba «Solicitar reserva» y la pantalla
// saltaba a `/ingresar` sin una línea que dijera por qué. El horario elegido se
// perdía en el salto, y la puerta para crear la cuenta era un enlace pequeño al
// pie de un formulario de contraseña. Mucha gente que quería agendar terminaba
// ahí, sin entender qué le habían pedido.
//
// Acá la pregunta se hace de frente y con dos salidas del mismo tamaño, porque
// las dos son legítimas. Las dos llevan la reserva puesta: el `next` reabre esta
// misma página con el mismo profesional, el mismo servicio y —si ya lo eligió—
// el mismo horario.
//
// Se muestra dos veces, y no es redundancia: arriba, para que nadie descubra el
// requisito al final; y al confirmar, que es donde la intención está hecha y el
// horario ya tiene nombre.

import Link from "next/link";
import { etiquetaDelHorario, rutaDeReserva } from "@/lib/intencion-de-agenda";

export default function CuentaParaAgendar({
  professionalId,
  serviceId,
  professionalName,
  serviceTitle,
  fecha = null,
  hora = null,
  variante = "entrada",
  onElegirOtro,
}) {
  const volver = rutaDeReserva({ professionalId, serviceId, fecha, hora });
  if (!volver) return null;

  const destino = encodeURIComponent(volver);
  const horario = etiquetaDelHorario(fecha, hora);
  const alConfirmar = variante === "confirmar";

  return (
    <section
      className={`rounded-2xl border p-5 ${
        alConfirmar ? "border-brand-400 bg-white shadow-card" : "border-brand-200 bg-brand-50"
      }`}
      aria-live={alConfirmar ? "polite" : undefined}
    >
      {alConfirmar && horario ? (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Estás a un paso</p>
          <p className="mt-2 text-lg font-bold leading-snug text-neutral-950">{horario}</p>
          <p className="text-sm text-neutral-700">
            {serviceTitle}
            {professionalName ? ` · ${professionalName}` : ""}
          </p>
          <p className="mt-3 text-sm text-neutral-800">
            Guardamos esta elección. Para reservarla necesitamos saber quién sos.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-brand-900">Para agendar necesitás una cuenta.</p>
          <p className="mt-1 text-sm text-brand-900">
            Crearla es gratis y toma un minuto. Podés mirar los horarios antes de decidir: el que
            elijas te espera del otro lado.
          </p>
        </>
      )}

      <p className="mt-4 text-sm font-semibold text-neutral-900">¿Ya tenés usuario?</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {/* Dos caminos del mismo peso visual: el que ya tiene cuenta no debería
            tener que buscar su puerta, y el que no la tiene tampoco. */}
        <Link
          href={`/ingresar?next=${destino}`}
          className="flex items-center justify-center rounded-xl border border-brand-700 bg-white px-4 py-3 text-center text-sm font-bold text-brand-800 transition hover:bg-brand-50"
        >
          Sí, ingresar{alConfirmar ? " y confirmar" : ""}
        </Link>
        <Link
          href={`/registro/usuario?next=${destino}`}
          className="flex items-center justify-center rounded-xl bg-brand-700 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-brand-800"
        >
          No, crear mi usuario
        </Link>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        {horario
          ? "Al volver te dejamos en este mismo horario, listo para confirmar."
          : "Al volver te dejamos en esta misma agenda."}
      </p>

      {alConfirmar && onElegirOtro ? (
        <button
          type="button"
          onClick={onElegirOtro}
          className="mt-2 text-xs font-semibold text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
        >
          Elegir otro horario
        </button>
      ) : null}
    </section>
  );
}
