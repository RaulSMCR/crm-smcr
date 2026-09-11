// src/lib/price-ladder.js
//
// Escalera de precios de lanzamiento: el precio general de una consulta empieza
// más bajo y sube por escalones a medida que llegan pacientes nuevos. Ejemplo:
// 10 pacientes a ₡30.000, luego 10 a ₡35.000, luego 10 a ₡40.000.
//
// Reglas, decididas por Raúl el 2026-09-11:
// - Aplica solo a pacientes NUEVOS con el profesional, y solo sobre la tarifa
//   general de la consulta (sin lugar ni franja). Las tarifas por lugar o franja
//   no cambian.
// - Un escalón rige mientras le queden cupos. El cupo se ocupa al PAGAR el
//   adelanto de la primera cita, no al reservar. Quien reservó a un precio lo
//   conserva aunque el escalón se llene antes de que pague, así que un escalón
//   puede cerrar con más pacientes que cupos.
// - Quien entra en un escalón conserva ese precio en todas sus sesiones de esa
//   consulta con ese profesional.
// - Los pacientes que ya se atendían antes siguen con su tarifa normal.
// - Completada la escalera, rige la tarifa general aprobada.
// - Al público se le muestra solo el precio vigente, sin cupos.
//
// Funciones puras: sirven igual en el servidor y en el navegador.

export const LIMITES_ESCALERA = Object.freeze({ escalones: 10, cupos: 500 });

function redondearMonto(valor) {
  return Math.round(Number(valor) * 100) / 100;
}

/**
 * Normaliza los escalones que propone el profesional. La posición es el orden
 * en que los cargó.
 *
 * @returns {{ escalones: Array<{position: number, price: number, capacity: number}> } | { error: string }}
 */
export function validarEscalones(entrada) {
  const filas = Array.isArray(entrada) ? entrada : [];
  if (filas.length === 0) return { error: "Agregue al menos un escalón." };
  if (filas.length > LIMITES_ESCALERA.escalones) {
    return { error: `La escalera admite hasta ${LIMITES_ESCALERA.escalones} escalones.` };
  }

  const escalones = [];
  for (const [indice, fila] of filas.entries()) {
    const numero = indice + 1;
    const price = redondearMonto(fila?.price);
    const capacity = Number(fila?.capacity);

    if (!Number.isFinite(price) || price <= 0) {
      return { error: `El escalón ${numero} necesita un precio mayor que cero.` };
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > LIMITES_ESCALERA.cupos) {
      return {
        error: `El escalón ${numero} necesita una cantidad de pacientes entre 1 y ${LIMITES_ESCALERA.cupos}.`,
      };
    }

    escalones.push({ position: numero, price, capacity });
  }

  return { escalones };
}

function enOrden(escalera) {
  return [...(escalera?.tiers || [])].sort((a, b) => Number(a.position) - Number(b.position));
}

/**
 * El escalón que rige hoy para un paciente nuevo: el primero con cupos libres.
 * `null` si no hay escalera o si ya se completó.
 */
export function escalonVigente(escalera) {
  return enOrden(escalera).find((tier) => Number(tier.seatsTaken) < Number(tier.capacity)) || null;
}

/** ¿Ya no queda ningún escalón con cupos? */
export function escaleraCompleta(escalera) {
  const tiers = enOrden(escalera);
  return tiers.length > 0 && tiers.every((tier) => Number(tier.seatsTaken) >= Number(tier.capacity));
}

/** La tarifa general es la que no está atada a un lugar ni a una franja. */
export function esTarifaGeneral(rate) {
  return Boolean(rate) && rate.locationId == null && rate.timeBandId == null;
}

/**
 * Qué paga una reserva sobre la tarifa que ya resolvió la cascada.
 *
 * @param {object} p
 * @param {object} p.rate               tarifa resuelta, con locationId y timeBandId
 * @param {object|null} p.escalera      escalera APROBADA de la consulta, con sus tiers
 * @param {object|null} p.inscripcion   precio con que el paciente ya entró en esa consulta
 * @param {boolean} p.esPacienteNuevo   sin citas previas con el profesional
 * @returns {{ price: number, priceTierId: string|null, origen: "TARIFA"|"ESCALON"|"INSCRIPCION" }}
 */
export function precioConEscalera({ rate, escalera = null, inscripcion = null, esPacienteNuevo = false }) {
  const normal = { price: Number(rate?.approvedPrice), priceTierId: null, origen: "TARIFA" };
  if (!esTarifaGeneral(rate)) return normal;

  if (Number(inscripcion?.price) > 0) {
    return { price: Number(inscripcion.price), priceTierId: null, origen: "INSCRIPCION" };
  }

  if (esPacienteNuevo) {
    const escalon = escalonVigente(escalera);
    if (escalon && Number(escalon.price) > 0) {
      return { price: Number(escalon.price), priceTierId: escalon.id ?? null, origen: "ESCALON" };
    }
  }

  return normal;
}

/** El precio que se anuncia al público: el que pagaría hoy un paciente nuevo. */
export function precioPublicoDeTarifa(rate, escalera = null) {
  return precioConEscalera({ rate, escalera, esPacienteNuevo: true }).price;
}
