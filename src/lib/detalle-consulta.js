// src/lib/detalle-consulta.js
//
// Cómo se nombra una consulta en los dos lugares donde alguien la lee y tiene
// que reconocerla: el **detalle de la factura electrónica** y el **rótulo del
// cobro de ONVO**. Los dos dicen lo mismo, y por eso se arman acá y no en cada
// llamador: cuando el paciente compara el cargo de su tarjeta con la factura,
// una redacción distinta en cada lado parece un cobro distinto.
//
// Lo que tiene que decir el detalle, decidido con el criterio de Hacienda y del
// paciente que lo lee:
//
//   • que lo facturado son **servicios profesionales** (la unidad de medida de
//     la línea ya es "Sp", esto lo hace legible además de codificado);
//   • **una** consulta, por el valor de la consulta;
//   • la **fecha de la consulta**;
//   • el **nombre del profesional con su título** ("Lic. Ana Solano").
//
// El CABYS y el 4% incluido en lo que el paciente pagó los pone quien construye
// la línea; acá solo se redacta.

import { nombreConGrado } from "@/lib/grados-academicos";

/** Lo que va en `productName` de la línea de una consulta. */
export const PRODUCTO_SERVICIOS_PROFESIONALES = "Servicios profesionales";

/**
 * El cargo por avisar tarde o no asistir **no es una consulta efectiva** —así lo
 * dice el Anexo económico— así que no puede facturarse con el mismo rótulo. No
 * devengó comisión ni avanzó la secuencia de consultas de nadie.
 */
export const PRODUCTO_CARGO_CANCELACION = "Cargo por cancelación tardía";

const TZ = "America/Costa_Rica";

const FECHA_LARGA = new Intl.DateTimeFormat("es-CR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-CR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function fechaValida(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "15 de agosto de 2026", en hora de Costa Rica. */
export function fechaLargaCR(value) {
  const date = fechaValida(value);
  return date ? FECHA_LARGA.format(date) : "";
}

/** "15 ago, 10:00", en hora de Costa Rica. */
export function fechaCortaCR(value) {
  const date = fechaValida(value);
  return date ? FECHA_CORTA.format(date) : "";
}

export function paymentTypeLabel(type) {
  if (type === "DEPOSIT_50") return "adelanto 50%";
  if (type === "BALANCE_50") return "saldo 50%";
  if (type === "PENALTY_50") return "cargo por cancelación tardía";
  return "pago 100%";
}

/**
 * "Lic. Ana Solano" a partir de una cita ya hidratada. Acepta las dos formas en
 * que el profesional viaja por el código: el perfil con su `user` anidado, o el
 * `user` suelto con el grado al lado.
 */
export function nombreDelProfesional(profesional) {
  if (!profesional) return "";
  const nombre = profesional.user?.name ?? profesional.name ?? "";
  const grado = profesional.academicDegree ?? profesional.user?.academicDegree ?? null;
  return nombreConGrado(nombre, grado);
}

/**
 * Detalle de la línea de factura de una cita.
 *
 * @returns {{productName: string, description: string}}
 */
export function detalleLineaFactura({ fecha, profesional, paymentType } = {}) {
  const esCargo = paymentType === "PENALTY_50";
  const cuando = fechaLargaCR(fecha);
  const quien = nombreDelProfesional(profesional);

  // El sustantivo cambia con la naturaleza del cobro: una cancelación tardía se
  // cobra sobre una *cita*, no sobre una consulta que no ocurrió.
  const nucleo = esCargo
    ? cuando
      ? `cita del ${cuando}`
      : "cita"
    : cuando
      ? `consulta del ${cuando}`
      : "consulta";

  const conQuien = quien ? ` con ${quien}` : "";

  let description;
  if (esCargo) {
    description = `Cargo por cancelación tardía de la ${nucleo}${conQuien}`;
  } else if (paymentType === "DEPOSIT_50") {
    description = `Adelanto 50% de la ${nucleo}${conQuien}`;
  } else if (paymentType === "BALANCE_50") {
    description = `Saldo 50% de la ${nucleo}${conQuien}`;
  } else {
    description = `${nucleo.charAt(0).toUpperCase()}${nucleo.slice(1)}${conQuien}`;
  }

  return {
    productName: esCargo ? PRODUCTO_CARGO_CANCELACION : PRODUCTO_SERVICIOS_PROFESIONALES,
    description,
  };
}

/** ONVO devuelve el nombre con la codificación rota: se manda sin tildes. */
function sinTildes(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Rótulo que el paciente ve en el checkout de ONVO y después en el estado de
 * cuenta de su tarjeta. Dice lo mismo que el detalle de la factura: qué se
 * cobra, con quién y cuándo fue la consulta.
 *
 * ONVO recorta el nombre del producto a 120 caracteres. Antes que dejar que el
 * recorte se coma la fecha —el dato con el que alguien reconoce un cargo— se
 * suelta primero el lugar, que es el menos identificatorio.
 */
export function rotuloCobroOnvo(appointment, paymentType, { limite = 120 } = {}) {
  const etiqueta = paymentTypeLabel(paymentType);
  const servicio = appointment?.service?.title || "Consulta";
  const quien = nombreDelProfesional(appointment?.professional);
  const lugar = appointment?.locationName || "";
  const cuando = fechaCortaCR(appointment?.date);

  const armar = (conLugar) =>
    sinTildes(
      [etiqueta, servicio, quien, conLugar ? lugar : null, cuando].filter(Boolean).join(" - ")
    );

  const completo = armar(true);
  if (completo.length <= limite) return completo;

  const sinLugar = armar(false);
  return sinLugar.length <= limite ? sinLugar : sinLugar.slice(0, limite);
}
