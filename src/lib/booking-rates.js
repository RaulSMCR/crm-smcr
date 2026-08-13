// src/lib/booking-rates.js
// Qué se le ofrece al paciente para un horario concreto y a qué precio.
//
// El paciente elige la modalidad sobre un mismo horario, así que un slot puede
// tener varias opciones (presencial ₡40.000 / virtual ₡35.000). El precio de cada
// una sale de la cascada de tarifas (src/lib/rates.js) evaluada con el lugar de
// esa opción y la franja horaria en la que cae la cita.

import { prisma } from "@/lib/prisma";
import {
  dayOfWeekInZone,
  minutesOfDay,
  parseHHMM,
  resolveRate,
  resolveTimeBand,
  snapshotLocation,
} from "@/lib/rates";

const TZ = process.env.APP_TIMEZONE || "America/Costa_Rica";

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
 * Opciones de modalidad y precio para un horario.
 *
 * @returns {Promise<{ options: Array<object>, timeBand: object|null }>}
 *   Cada opción trae `bookable:false` cuando no hay tarifa aprobada que la cubra,
 *   para poder mostrarla deshabilitada en vez de esconderla sin explicación.
 */
export async function getBookingOptions({ professionalId, serviceId, startsAt }) {
  if (!professionalId || !serviceId || !startsAt) return { options: [], timeBand: null };

  const dayOfWeek = dayOfWeekInZone(startsAt, TZ);
  const minutes = minutesOfDay(startsAt, TZ);
  if (dayOfWeek === null || minutes === null) return { options: [], timeBand: null };

  const [rates, timeBands, activeLocations, availability] = await Promise.all([
    prisma.professionalRate.findMany({
      where: { professionalId, serviceId, status: "APPROVED" },
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
              price: Number(rate.approvedPrice),
              rateId: rate.id,
              bookable: true,
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
      price: rate ? Number(rate.approvedPrice) : null,
      rateId: rate?.id ?? null,
      bookable: Boolean(rate),
    };
  });

  return { options, timeBand };
}

/**
 * Valida la elección del paciente y devuelve lo que se congela en la cita.
 * Se vuelve a resolver el precio en el servidor: lo que el cliente mande como
 * monto es solo informativo y nunca se persiste tal cual.
 *
 * @returns {Promise<{ error: string }|{ data: object }>}
 */
export async function resolveBookingSelection({ professionalId, serviceId, startsAt, locationId = null }) {
  const { options, timeBand } = await getBookingOptions({ professionalId, serviceId, startsAt });

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
      timeBandName: timeBand?.name ?? null,
      ...snapshotLocation(location),
    },
  };
}
