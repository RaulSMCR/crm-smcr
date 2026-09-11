// src/lib/booking-rates.js
// Qué se le ofrece al paciente para un horario concreto y a qué precio.
//
// El paciente elige la modalidad sobre un mismo horario, así que un slot puede
// tener varias opciones (presencial ₡40.000 / virtual ₡35.000). El precio de cada
// una sale de la cascada de tarifas (src/lib/rates.js) evaluada con el lugar de
// esa opción y la franja horaria en la que cae la cita. Sobre la tarifa general
// puede regir además una escalera de precios (src/lib/price-ladder.js), que
// depende de quién reserva.

import { prisma } from "@/lib/prisma";
import {
  dayOfWeekInZone,
  minutesOfDay,
  parseHHMM,
  resolveRate,
  resolveTimeBand,
  snapshotLocation,
} from "@/lib/rates";
import { ESCALERA_APROBADA, TARIFA_VIGENTE } from "@/lib/service-pricing";
import { precioConEscalera } from "@/lib/price-ladder";

const TZ = process.env.APP_TIMEZONE || "America/Costa_Rica";

/**
 * Los mismos estados que CANCELLED_APPOINTMENT_STATUSES de booking-conflicts. Se
 * repiten para no arrastrar el cliente de Google a este módulo.
 */
const CITAS_CANCELADAS = ["CANCELLED_BY_USER", "CANCELLED_BY_PRO"];

/**
 * Lugares que el profesional ofrece en el bloque que contiene esa hora.
 *
 * El bloque solo sirve para RESTRINGIR: si declara lugares, manda esa lista. Si
 * no declara ninguno —o si no hay bloque que cubra la hora, como cuando un admin
 * agenda fuera del horario habitual— se ofrecen todos los lugares activos. Los
 * lugares son del profesional, no del bloque, así que no tenerlos declarados no
 * puede dejar una cita sin dónde atenderse.
 */
function locationsForSlot({ availability, activeLocations, dayOfWeek, minutes }) {
  const block = availability.find((item) => {
    if (item.dayOfWeek !== dayOfWeek) return false;
    const start = parseHHMM(item.startTime);
    const end = parseHHMM(item.endTime);
    if (start === null || end === null) return false;
    return minutes >= start && minutes < end;
  });

  const declared = (block?.locations || []).map((link) => link.location).filter((loc) => loc?.isActive);
  return { block: block || null, locations: declared.length > 0 ? declared : activeLocations };
}

/**
 * Lo que la escalera de precios necesita saber de quien reserva: la escalera
 * aprobada de la consulta, si el paciente ya entró en ella y si es nuevo con el
 * profesional. Sin paciente —alguien mirando sin sesión— se lo trata como nuevo,
 * que es el precio que se le anuncia al público.
 */
async function contextoDeEscalera({ professionalId, serviceId, patientId }) {
  const paciente = patientId ? String(patientId) : null;

  const [escalera, inscripcion, previas] = await Promise.all([
    prisma.priceLadder.findFirst({
      where: { professionalId, serviceId, ...ESCALERA_APROBADA.where },
      select: ESCALERA_APROBADA.select,
    }),
    paciente
      ? prisma.priceLadderEnrollment.findUnique({
          where: { patientId_professionalId_serviceId: { patientId: paciente, professionalId, serviceId } },
          select: { price: true },
        })
      : null,
    paciente
      ? prisma.appointment.count({
          where: { patientId: paciente, professionalId, status: { notIn: CITAS_CANCELADAS } },
        })
      : 0,
  ]);

  return { escalera, inscripcion, esPacienteNuevo: !paciente || previas === 0 };
}

/** Precio y trazabilidad de una opción, o su versión no reservable si no hay tarifa. */
function precioDeOpcion(rate, contexto) {
  if (!rate) return { price: null, rateId: null, priceTierId: null, bookable: false };
  const precio = precioConEscalera({ rate, ...contexto });
  return { price: precio.price, rateId: rate.id, priceTierId: precio.priceTierId, bookable: true };
}

/**
 * Opciones de modalidad y precio para un horario.
 *
 * `patientId` es quien reserva: decide si le toca un escalón de la escalera, el
 * precio con que ya entró o la tarifa normal. Sin él se muestra el precio de un
 * paciente nuevo.
 *
 * @returns {Promise<{ options: Array<object>, timeBand: object|null }>}
 *   Cada opción trae `bookable:false` cuando no hay tarifa aprobada que la cubra,
 *   para poder mostrarla deshabilitada en vez de esconderla sin explicación.
 */
export async function getBookingOptions({ professionalId, serviceId, startsAt, patientId = null }) {
  if (!professionalId || !serviceId || !startsAt) return { options: [], timeBand: null };

  const dayOfWeek = dayOfWeekInZone(startsAt, TZ);
  const minutes = minutesOfDay(startsAt, TZ);
  if (dayOfWeek === null || minutes === null) return { options: [], timeBand: null };

  const [rates, timeBands, activeLocations, availability, contexto] = await Promise.all([
    prisma.professionalRate.findMany({
      // Rige el precio aprobado aunque haya una propuesta nueva en revisión.
      where: { professionalId, serviceId, ...TARIFA_VIGENTE },
    }),
    prisma.professionalTimeBand.findMany({
      where: { professionalId },
      orderBy: [{ displayOrder: "asc" }, { startTime: "asc" }],
    }),
    prisma.practiceLocation.findMany({
      where: { professionalId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.availability.findMany({
      where: { professionalId, dayOfWeek },
      include: { locations: { include: { location: true } } },
    }),
    contextoDeEscalera({ professionalId, serviceId, patientId }),
  ]);

  const timeBand = resolveTimeBand(timeBands, minutes);
  const { locations } = locationsForSlot({ availability, activeLocations, dayOfWeek, minutes });

  // Sin lugares configurados el precio igual puede resolverse por el catch-all:
  // se ofrece una única opción sin lugar, que es como funcionaba antes.
  if (locations.length === 0) {
    const rate = resolveRate(rates, { locationId: null, timeBandId: timeBand?.id ?? null });
    return {
      timeBand,
      options: rate
        ? [
            {
              locationId: null,
              name: "Consulta",
              modality: null,
              address: null,
              instructions: null,
              ...precioDeOpcion(rate, contexto),
            },
          ]
        : [],
    };
  }

  const options = locations.map((location) => {
    const rate = resolveRate(rates, { locationId: location.id, timeBandId: timeBand?.id ?? null });
    return {
      locationId: location.id,
      name: location.name,
      modality: location.modality,
      address: location.modality === "HOME" ? null : location.address,
      instructions: location.instructions,
      ...precioDeOpcion(rate, contexto),
    };
  });

  return { options, timeBand };
}

/**
 * Valida la elección del paciente y devuelve lo que se congela en la cita.
 * Se vuelve a resolver el precio en el servidor: lo que el cliente mande como
 * monto es solo informativo y nunca se persiste tal cual.
 *
 * `priceTierId` viene cargado cuando el precio salió de un escalón de la
 * escalera: la cita lo guarda para ocupar el cupo cuando se pague.
 *
 * @returns {Promise<{ error: string }|{ data: object }>}
 */
export async function resolveBookingSelection({ professionalId, serviceId, startsAt, locationId = null, patientId = null }) {
  const { options, timeBand } = await getBookingOptions({ professionalId, serviceId, startsAt, patientId });

  if (options.length === 0) {
    return { error: "Este profesional aún no tiene un precio aprobado para ese horario." };
  }

  const wanted = locationId ? String(locationId) : null;
  const selected = wanted
    ? options.find((option) => option.locationId === wanted)
    : options.length === 1
      ? options[0]
      : null;

  if (!selected) {
    return wanted
      ? { error: "La modalidad seleccionada no está disponible en ese horario." }
      : { error: "Seleccione dónde desea ser atendido." };
  }

  if (!selected.bookable) {
    return { error: `El profesional aún no tiene un precio aprobado para "${selected.name}" en ese horario.` };
  }

  const location = selected.locationId
    ? await prisma.practiceLocation.findFirst({
        where: { id: selected.locationId, professionalId },
      })
    : null;

  return {
    data: {
      pricePaid: selected.price,
      rateId: selected.rateId,
      priceTierId: selected.priceTierId ?? null,
      timeBandName: timeBand?.name ?? null,
      ...snapshotLocation(location),
    },
  };
}
