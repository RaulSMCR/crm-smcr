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

/** Una tarifa cuenta si un admin la aprobó y tiene monto. Sirve como `where` de Prisma. */
export const TARIFA_VIGENTE = Object.freeze({ status: "APPROVED", approvedPrice: { not: null } });

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
 * Menor y mayor precio de un conjunto de tarifas ya filtradas como vigentes.
 * Devuelve `null` cuando no hay ninguna: es distinto de un rango de cero, y quien
 * llama tiene que poder decir "todavía no hay precio" en vez de mostrar ₡0.
 */
export function rangoDePrecios(rates = []) {
  const montos = (rates || [])
    .map((rate) => Number(rate?.approvedPrice))
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
 * Va por agregación y no contando las asignaciones que la página ya trae, porque
 * esa lista viene recortada para mostrar unos pocos avatares: calcular el rango
 * sobre ese recorte anunciaría un máximo que no es el máximo. Recibe el cliente
 * de Prisma en vez de importarlo para que este módulo siga sirviendo también en
 * el cliente, donde solo se usan las funciones de formato.
 *
 * @returns {Promise<Map<string, {min: number, max: number}>>}
 */
export async function rangosPorServicio(prisma, serviceIds = []) {
  const ids = [...new Set((serviceIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const filas = await prisma.professionalRate.groupBy({
    by: ["serviceId"],
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
    _min: { approvedPrice: true },
    _max: { approvedPrice: true },
  });

  return new Map(
    filas
      .map((fila) => {
        const min = Number(fila._min.approvedPrice);
        const max = Number(fila._max.approvedPrice);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return [fila.serviceId, { min, max }];
      })
      .filter(Boolean),
  );
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
