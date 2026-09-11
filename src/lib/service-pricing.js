// src/lib/service-pricing.js
//
// Qué precio se le enseña al público, y de dónde sale.
//
// El precio vive en `ProfessionalRate` (servicio × lugar × franja), no en
// `ServiceAssignment.approvedSessionPrice`, que quedó obsoleto cuando se pasó al
// modelo por lugar y franja. Las páginas públicas seguían leyendo el campo viejo
// mientras el panel escribía en el nuevo, y esa costura suelta dejó a tres de
// cuatro profesionales publicados sin precio y sin agenda. Este módulo es el
// único lugar donde se decide qué es "una tarifa vigente", para que la ficha del
// profesional, el listado de servicios y la pantalla de agendar no puedan volver
// a responderlo de tres maneras distintas.
//
// Con la escalera de precios (src/lib/price-ladder.js), el precio público de la
// tarifa general puede no ser su `approvedPrice`: es el del escalón vigente. Por
// eso las páginas traen las tarifas con SELECT_TARIFA_PUBLICA, que incluye la
// escalera, y rangoDePrecios la aplica.

import { precioPublicoDeTarifa } from "@/lib/price-ladder";

/**
 * Una tarifa cuenta si tiene un precio aprobado. Sirve como `where` de Prisma.
 *
 * No mira `status`, a propósito. El estado es el de la ÚLTIMA PROPUESTA, no el
 * del precio: cuando el profesional propone un monto nuevo la fila pasa a
 * PENDING y conserva `approvedPrice`, que es el que tiene que seguir rigiendo
 * hasta que un admin decida. Filtrar por APPROVED dejaba al profesional sin
 * precio público y sin agenda mientras su propuesta esperaba revisión. Un
 * rechazo tampoco borra el precio aprobado (ver reviewRate).
 */
export const TARIFA_VIGENTE = Object.freeze({ approvedPrice: { gt: 0 } });

/**
 * La escalera aprobada de una consulta, con la forma de un `select` de relación.
 * Hay una sola por consulta: lo garantiza un índice único parcial.
 */
export const ESCALERA_APROBADA = Object.freeze({
  where: { status: "APPROVED" },
  take: 1,
  select: {
    id: true,
    tiers: {
      orderBy: { position: "asc" },
      select: { id: true, position: true, price: true, capacity: true, seatsTaken: true },
    },
  },
});

/**
 * Lo que hay que traer de cada tarifa para anunciar su precio: el monto, si es la
 * general (sin lugar ni franja) y la escalera de su consulta. Todas las páginas
 * públicas lo usan, para que ninguna anuncie un precio que ignore la escalera.
 */
export const SELECT_TARIFA_PUBLICA = Object.freeze({
  approvedPrice: true,
  locationId: true,
  timeBandId: true,
  assignment: { select: { priceLadders: ESCALERA_APROBADA } },
});

/**
 * Un monto en colones, como se escribe en Costa Rica.
 *
 * Estaba copiada en siete componentes, y las copias no eran iguales: unas
 * devolvían "—" ante un valor vacío, otra `null` y otra aceptaba otra moneda.
 * Por eso `vacio` y `moneda` son parámetros en vez de constantes — unificar sin
 * ellos habría cambiado lo que se ve en pantalla en la mitad de las pantallas.
 *
 * @param {*} value
 * @param {{vacio?: *, moneda?: string}} [opciones]
 */
export function formatCRC(value, { vacio = "Precio no disponible", moneda = "CRC" } = {}) {
  if (value === null || value === undefined || value === "") return vacio;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return vacio;
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Menor y mayor precio público de un conjunto de tarifas ya filtradas como
 * vigentes. Si cada tarifa trae su escalera (SELECT_TARIFA_PUBLICA), la general
 * se anuncia al precio del escalón vigente.
 *
 * Devuelve `null` cuando no hay ninguna: es distinto de un rango de cero, y quien
 * llama tiene que poder decir "todavía no hay precio" en vez de mostrar ₡0.
 */
export function rangoDePrecios(rates = []) {
  const montos = (rates || [])
    .map((rate) => precioPublicoDeTarifa(rate, rate?.assignment?.priceLadders?.[0] || null))
    .filter((monto) => Number.isFinite(monto) && monto > 0);

  if (montos.length === 0) return null;
  return { min: Math.min(...montos), max: Math.max(...montos) };
}

/** Junta los rangos de varios profesionales en el rango del servicio. */
export function rangoDeServicio(assignments = []) {
  return rangoDePrecios((assignments || []).flatMap((a) => a?.rates || []));
}

/**
 * Rango de precios de cada servicio, sobre TODOS sus profesionales.
 *
 * Va aparte y no contando las asignaciones que la página ya trae, porque esa
 * lista viene recortada para mostrar unos pocos avatares: calcular el rango
 * sobre ese recorte anunciaría un máximo que no es el máximo. Recibe el cliente
 * de Prisma en vez de importarlo para que este módulo siga sirviendo también en
 * el cliente, donde solo se usan las funciones de formato.
 *
 * Antes era un `groupBy` con mínimo y máximo de `approvedPrice`. Con la escalera
 * el precio público de la tarifa general depende del escalón vigente, que la
 * base no sabe agregar, así que se traen las tarifas y el rango se calcula acá.
 *
 * @returns {Promise<Map<string, {min: number, max: number}>>}
 */
export async function rangosPorServicio(prisma, serviceIds = []) {
  const ids = [...new Set((serviceIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const tarifas = await prisma.professionalRate.findMany({
    where: {
      ...TARIFA_VIGENTE,
      serviceId: { in: ids },
      // Solo cuenta el precio de quien está realmente ofreciendo el servicio: un
      // profesional suspendido no puede seguir fijando el mínimo del catálogo.
      assignment: {
        is: {
          status: "APPROVED",
          professional: { is: { isApproved: true, user: { is: { isActive: true } } } },
        },
      },
    },
    select: { serviceId: true, ...SELECT_TARIFA_PUBLICA },
  });

  const porServicio = new Map();
  for (const tarifa of tarifas) {
    if (!porServicio.has(tarifa.serviceId)) porServicio.set(tarifa.serviceId, []);
    porServicio.get(tarifa.serviceId).push(tarifa);
  }

  const rangos = new Map();
  for (const [serviceId, lista] of porServicio) {
    const rango = rangoDePrecios(lista);
    if (rango) rangos.set(serviceId, rango);
  }
  return rangos;
}

/**
 * Cómo se escribe un rango. Un solo monto cuando todos cobran igual —repetir
 * "₡40 000 – ₡40 000" es ruido—, y el rango completo cuando difieren.
 */
export function etiquetaDeRango(rango, { sinPrecio = "Precio según profesional" } = {}) {
  if (!rango) return sinPrecio;
  if (rango.min === rango.max) return formatCRC(rango.min);
  return `${formatCRC(rango.min)} – ${formatCRC(rango.max)}`;
}
