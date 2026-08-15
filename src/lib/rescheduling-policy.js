// src/lib/rescheduling-policy.js
// Política de reagendado y multa por aviso tardío.
//
// La regla del negocio:
//
//   El paciente puede mover su cita dentro de la semana avisando con al menos
//   24 horas. Pasado ese margen la cita ya no se puede mover por cuenta propia:
//   se cobra el 50% del valor y el paciente queda sin poder agendar solo, hasta
//   que el administrador lo contacte y le devuelva el acceso.
//
// Lo mismo vale si el profesional marca la cita como no asistida: el espacio se
// perdió igual que con una cancelación tardía.
//
// El bloqueo no es un castigo automático que se olvida: es lo que obliga a que
// haya una conversación antes de volver a agendar. Por eso solo lo levanta una
// persona.

/** Horas de aviso mínimas para mover una cita sin multa. */
export const HORAS_MINIMAS_REAGENDA = 24;

/** Porcentaje del valor de la cita que se cobra cuando se avisa tarde. */
export const PORCENTAJE_MULTA = 50;

export const MOTIVOS_BLOQUEO = Object.freeze({
  REAGENDA_TARDIA: "REAGENDA_TARDIA",
  NO_ASISTIO: "NO_ASISTIO",
});

export const ETIQUETAS_BLOQUEO = Object.freeze({
  REAGENDA_TARDIA: "Cambio con menos de 24 horas de aviso",
  NO_ASISTIO: "No asistió a la cita",
});

/** Multa en la moneda de la cita. Devuelve 0 si no hay precio congelado. */
export function montoMulta(pricePaid) {
  const total = Number(pricePaid || 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  // En céntimos para que el redondeo no invente ni pierda un colón.
  return Math.round((total * 100 * PORCENTAJE_MULTA) / 100) / 100;
}

/** Horas que faltan para la cita. Negativo si ya pasó. */
export function horasHasta(fechaCita, ahora = new Date()) {
  const inicio = new Date(fechaCita).getTime();
  const referencia = new Date(ahora).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(referencia)) return null;
  return (inicio - referencia) / (1000 * 60 * 60);
}

/**
 * ¿Puede el paciente mover esta cita por su cuenta?
 *
 * Separa dos cosas que se confunden fácil: estar dentro del margen de 24 horas
 * (propio de ESTA cita) y tener el agendamiento habilitado (propio del
 * paciente, y que arrastra de una cita anterior).
 *
 * @returns {{permitido: boolean, motivo?: string, mensaje?: string,
 *            horasRestantes: number|null, multa: number}}
 */
export function evaluarReagenda({ fechaCita, pricePaid, ahora = new Date(), bloqueado = false }) {
  const horasRestantes = horasHasta(fechaCita, ahora);
  const multa = montoMulta(pricePaid);

  if (bloqueado) {
    return {
      permitido: false,
      motivo: "AGENDAMIENTO_BLOQUEADO",
      mensaje:
        "Su agenda está en pausa. La administración se pondrá en contacto para coordinar su " +
        "próxima cita.",
      horasRestantes,
      multa,
    };
  }

  if (horasRestantes === null) {
    return { permitido: false, motivo: "FECHA_INVALIDA", horasRestantes: null, multa };
  }

  if (horasRestantes < HORAS_MINIMAS_REAGENDA) {
    const yaPaso = horasRestantes <= 0;
    return {
      permitido: false,
      motivo: "FUERA_DE_PLAZO",
      mensaje: yaPaso
        ? "La hora de la cita ya pasó, así que no puede moverse."
        : `Faltan menos de ${HORAS_MINIMAS_REAGENDA} horas para la cita, así que ya no puede ` +
          "moverse por este medio.",
      horasRestantes,
      multa,
    };
  }

  return { permitido: true, horasRestantes, multa };
}

/**
 * Cuánto queda por cobrar de la multa, descontando lo ya pagado.
 *
 * En una primera cita el adelanto ES el 50%, así que la multa ya está cubierta y
 * no corresponde cobrar de nuevo: lo pagado se retiene. Cobrar encima sería
 * cobrar el 100% de una cita que no ocurrió.
 */
export function saldoDeMulta(pricePaid, montoYaPagado) {
  const multa = montoMulta(pricePaid);
  const pagado = Number(montoYaPagado || 0);
  const pendiente = multa - (Number.isFinite(pagado) ? pagado : 0);
  return pendiente > 0 ? Math.round(pendiente * 100) / 100 : 0;
}
