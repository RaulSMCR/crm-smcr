// src/lib/acuerdo.js
// El acuerdo de atención: qué versión rige, cuándo se pide aceptarlo y cuándo
// se pide volver a leerlo.
//
// La idea que ordena todo esto:
//
//   Se lee antes de empezar. Se recuerda cuando el proceso arranca de verdad.
//   Se repasa cuando hubo un tropiezo. Nunca se usa como reprimenda.
//
// Por eso cada aceptación guarda su contexto: no es lo mismo aceptar al
// registrarse que releer después de faltar a una cita, y el texto que se le
// muestra a la persona cambia según cuál sea.
//
// El repaso es un candado independiente del de la agenda (ver
// lib/scheduling-block): un administrador puede devolverle el acceso y la
// persona igual tiene que releer antes de volver a reservar. Son dos cosas
// distintas —el permiso y la comprensión— y se resuelven por separado.

import { MOTIVOS_BLOQUEO } from "@/lib/rescheduling-policy";

/**
 * Versión vigente del acuerdo.
 *
 * Subir esto cuando cambie el texto de /terminos de forma sustantiva: a partir
 * de ahí se le vuelve a pedir aceptación a todo el mundo. Lo aceptado antes
 * sigue siendo válido para lo que pasó antes, así que nunca se reescriben
 * filas viejas de AceptacionAcuerdo.
 */
export const VERSION_ACUERDO = "2026-08";

/** En qué momento del recorrido se aceptó. */
export const CONTEXTOS = Object.freeze({
  REGISTRO: "REGISTRO",
  SEGUNDA_CITA: "SEGUNDA_CITA",
  REPASO_TRAS_MULTA: "REPASO_TRAS_MULTA",
  REPASO_TRAS_AUSENCIA: "REPASO_TRAS_AUSENCIA",
});

/**
 * Código que devuelven las acciones de reserva cuando hay un repaso pendiente.
 * La UI lo traduce en una redirección a /terminos?revisar=1.
 */
export const ERROR_ACUERDO_PENDIENTE = "ACUERDO_PENDIENTE";

/** Motivo del bloqueo → contexto con el que se le pide releer. */
export function contextoDeRepaso(motivoBloqueo) {
  return motivoBloqueo === MOTIVOS_BLOQUEO.NO_ASISTIO
    ? CONTEXTOS.REPASO_TRAS_AUSENCIA
    : CONTEXTOS.REPASO_TRAS_MULTA;
}

/** ¿Se le pidió releer el acuerdo y todavía no lo confirmó? */
export function necesitaReleerAcuerdo(user) {
  return Boolean(user?.acuerdoPendienteDesde);
}

/**
 * ¿Aceptó una versión anterior (o ninguna)?
 *
 * Se cumple también para las cuentas que existían antes de que el acuerdo
 * existiera. A esas no se les bloquea nada de golpe: se les pide aceptar la
 * primera vez que entran al panel.
 */
export function acuerdoDesactualizado(user) {
  return user?.acuerdoVersion !== VERSION_ACUERDO;
}

/**
 * ¿Hay que mostrarle la pantalla del acuerdo antes de dejarlo reservar?
 *
 * Cubre los dos casos: nunca lo aceptó (o cambió el texto) y le toca repasarlo.
 */
export function debeAceptarAcuerdo(user) {
  return necesitaReleerAcuerdo(user) || acuerdoDesactualizado(user);
}

/**
 * Con qué contexto corresponde registrar la aceptación que la persona está a
 * punto de dar. El repaso manda sobre la primera aceptación: si faltó a una
 * cita, lo que importa registrar es que releyó por eso.
 */
export function contextoPendiente(user) {
  if (necesitaReleerAcuerdo(user)) {
    return user.acuerdoPendienteMotivo || CONTEXTOS.REPASO_TRAS_MULTA;
  }
  return CONTEXTOS.REGISTRO;
}

/**
 * Cómo se le habla en la pantalla de repaso.
 *
 * No se le recuerda el monto ni se le enumera lo que hizo mal: eso ya lo sabe y
 * volver a decirlo solo agrega vergüenza a alguien que probablemente está por
 * abandonar. Lo que se le devuelve es el sentido de la regla y una salida.
 */
export function invitacionARepasar(contexto) {
  if (contexto === CONTEXTOS.REPASO_TRAS_AUSENCIA) {
    return {
      titulo: "Repasemos juntos cómo funciona tu espacio",
      cuerpo:
        "Faltar a una cita pasa, y no cambia nada de lo que venías construyendo. Te pedimos " +
        "leer una vez más cómo se sostiene tu espacio, para que la próxima vez que algo se " +
        "atraviese sepas exactamente qué hacer.",
      accion: "Listo, lo repasé",
    };
  }

  return {
    titulo: "Repasemos juntos cómo mover tu cita",
    cuerpo:
      "Mover una cita a tiempo es gratis y no hace falta explicar nada. Te pedimos leer una vez " +
      "más cómo hacerlo, para que la próxima vez no te tome por sorpresa.",
    accion: "Listo, lo repasé",
  };
}

/**
 * Datos que hay que traer del usuario para poder decidir todo lo anterior.
 * Se comparte para que las pantallas no se olviden de pedir un campo y crean,
 * por omisión, que la persona ya aceptó.
 */
export const SELECT_ACUERDO = Object.freeze({
  acuerdoVersion: true,
  acuerdoAceptadoAt: true,
  acuerdoPendienteDesde: true,
  acuerdoPendienteMotivo: true,
});
