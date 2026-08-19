// src/lib/slug-redirect.js
//
// Resolución de slugs viejos hacia el actual, para que cambiar una URL no
// signifique perderla.
//
// Se consulta **solo en el camino del 404**: cuando la búsqueda por slug no
// encontró nada y antes de llamar a `notFound()`. Nunca en el middleware, que
// correría en cada request del sitio y agregaría una consulta a la base a todas
// las URLs que sí funcionan.

import { prisma } from "@/lib/prisma";

/** Entidades con URL pública basada en slug. */
export const TIPOS = Object.freeze({
  POST: "post",
  PROFESIONAL: "professional",
  SERVICIO: "service",
});

const TIPOS_VALIDOS = new Set(Object.values(TIPOS));

/** Cuántos saltos se siguen antes de rendirse. Ver `resolveRedirect`. */
const MAX_SALTOS = 5;

function normalizar(slug) {
  return String(slug || "").trim().toLowerCase();
}

/**
 * Devuelve el slug vigente para uno viejo, o `null` si no hay redirect.
 *
 * Sigue cadenas: si un artículo migró dos veces, la primera URL publicada tiene
 * que llegar igual al destino final, no al intermedio. El límite de saltos
 * existe porque una cadena circular —posible si alguien registra a mano un
 * redirect de vuelta— colgaría la petición; ante un ciclo se devuelve `null` y
 * la página termina en 404, que es preferible a un bucle.
 *
 * **Nunca lanza.** Cualquier error de base devuelve `null` y la ruta sigue su
 * camino al 404. Es deliberado y es lo que permite desplegar este código antes
 * de que la tabla exista: mientras no esté creada, la consulta falla, se
 * registra y el sitio se comporta exactamente como antes. Si el error se
 * propagara, todo 404 del sitio pasaría a ser un 500, porque acá es justamente
 * donde se llega cuando una entidad no se encontró.
 */
export async function resolveRedirect(entityType, slug) {
  if (!TIPOS_VALIDOS.has(entityType)) return null;

  const origen = normalizar(slug);
  if (!origen) return null;

  try {
    const vistos = new Set([origen]);
    let actual = origen;

    for (let salto = 0; salto < MAX_SALTOS; salto += 1) {
      const fila = await prisma.slugRedirect.findUnique({
        where: { entityType_fromSlug: { entityType, fromSlug: actual } },
        select: { toSlug: true },
      });

      if (!fila) {
        // Se acabó la cadena. Si hubo al menos un salto, `actual` es el destino.
        return actual === origen ? null : actual;
      }

      const destino = normalizar(fila.toSlug);
      if (!destino || vistos.has(destino)) return null; // ciclo
      vistos.add(destino);
      actual = destino;
    }

    // Se agotaron los saltos sin llegar al final: la cadena está mal armada.
    console.error(`[slug-redirect] cadena demasiado larga para ${entityType}/${origen}`);
    return null;
  } catch (error) {
    console.error(`[slug-redirect] no se pudo resolver ${entityType}/${origen}:`, error?.message || error);
    return null;
  }
}

/**
 * Registra que `fromSlug` pasó a ser `toSlug`.
 *
 * La usan los scripts de migración de S4, S5 y S6, siempre dentro de la misma
 * transacción que actualiza el slug: si el redirect no se puede escribir, el
 * cambio de slug tampoco debe quedar. Por eso acepta un cliente de transacción
 * y por eso —al revés que `resolveRedirect`— **sí lanza**.
 */
export async function registrarRedirect(entityType, fromSlug, toSlug, cliente = prisma) {
  if (!TIPOS_VALIDOS.has(entityType)) {
    throw new Error(`Tipo de entidad desconocido: ${entityType}`);
  }

  const desde = normalizar(fromSlug);
  const hacia = normalizar(toSlug);

  if (!desde || !hacia) throw new Error("Un redirect necesita origen y destino.");
  if (desde === hacia) throw new Error(`El redirect de ${desde} apunta a sí mismo.`);

  // `upsert` y no `create` porque una migración se puede correr dos veces —un
  // dry-run mal leído, una corrida interrumpida a la mitad—, y la segunda vez
  // tiene que ser inofensiva en vez de reventar contra el índice único.
  return cliente.slugRedirect.upsert({
    where: { entityType_fromSlug: { entityType, fromSlug: desde } },
    update: { toSlug: hacia },
    create: { entityType, fromSlug: desde, toSlug: hacia },
  });
}
