import { SLUG_COPY_HUB } from "@/lib/hub-markdown";

/**
 * Orden de aparición y tarjeta destacada de los módulos de un hub.
 *
 * Puro y sin Prisma, por dos razones: la pantalla del panel necesita las mismas
 * reglas para pintar la lista, y la suite de este repo cubre `src/lib` y no las
 * server actions, así que lo que no viva acá no se prueba.
 *
 * Dos decisiones distintas que la pantalla presenta juntas:
 *   - **el orden** dice qué se lee antes, y se guarda contiguo (0..n-1);
 *   - **el destaque** dice qué se ve antes de leer, y hay uno por hub.
 *
 * El orden se renumera completo en cada guardado en vez de editar el número de
 * un módulo: con números sueltos, dos módulos podían compartir `position` y el
 * empate lo resolvía la base. Contiguo y en una transacción, el orden que se ve
 * en el panel es el que sale publicado.
 */

/** El módulo invisible del copy del hub no es una pieza que aparezca en ninguna parte. */
export function esOrdenable(modulo) {
  return Boolean(modulo?.slug) && modulo.slug !== SLUG_COPY_HUB;
}

/**
 * Por qué una pieza no se ve en la grilla del hub, o `null` si se ve.
 *
 * La grilla pública pinta solo módulos de tipo `TOPIC`, visibles y publicados
 * (`PUBLIC_HUB_INCLUDE` y `mapManagedHub` en src/lib/hub-raul.js). Sin esto, el
 * panel mostraría un orden de cinco tarjetas de las que en el sitio aparecen
 * dos, y el orden parecería no funcionar.
 */
export function motivoFueraDeGrilla(modulo) {
  if (!modulo) return "no existe";
  if (modulo.type === "TREATMENT") return "el tratamiento tiene su propia sección, no va en la grilla";
  if (modulo.type === "CUSTOM") return "el contenido personalizado no se pinta como tarjeta";
  if (modulo.isVisible === false) return "está oculto";
  if (modulo.isPublished !== true) return "está en borrador: no aparece hasta publicarse";
  return null;
}

/**
 * Resuelve un guardado de orden y destaque en las escrituras mínimas.
 *
 * @param {Array<{id: string, slug: string, type?: string, position?: number, isFeatured?: boolean}>} modulos
 *   los módulos del hub tal como están guardados.
 * @param {{orden?: string[], destacada?: string|null}} intencion `orden` es la lista
 *   completa de ids en el orden nuevo; `destacada` el id de la tarjeta destacada o
 *   `null` para que no haya ninguna.
 * @returns {{error?: string, escrituras?: Array<{id: string, position?: number, isFeatured?: boolean}>}}
 */
export function resolverOrden(modulos = [], intencion = {}) {
  const ordenables = (Array.isArray(modulos) ? modulos : []).filter(esOrdenable);
  const porId = new Map(ordenables.map((modulo) => [modulo.id, modulo]));

  const orden = [...new Set((Array.isArray(intencion.orden) ? intencion.orden : []).map((id) => String(id || "")).filter(Boolean))];
  if (!orden.length) return { error: "No llegó ningún orden." };

  // La lista tiene que ser una permutación exacta de lo que hay guardado. Si
  // falta uno, el guardado es de una pantalla vieja —otra pestaña, o la ingesta
  // creó un módulo mientras esta estaba abierta— y renumerar con esa lista
  // dejaría al módulo nuevo con un número que ya tiene otro.
  const desconocidos = orden.filter((id) => !porId.has(id));
  if (desconocidos.length) return { error: "Ese orden incluye módulos que no son de este hub." };
  if (orden.length !== ordenables.length) {
    return { error: "La lista está incompleta: recargá la pantalla, los módulos del hub cambiaron." };
  }

  const destacada = intencion.destacada === null || intencion.destacada === undefined ? null : String(intencion.destacada);
  if (destacada) {
    const elegida = porId.get(destacada);
    if (!elegida) return { error: "La pieza destacada no es de este hub." };
    // Destacar algo que la grilla no pinta no haría nada visible, y el panel
    // quedaría diciendo que hay una destacada que nadie ve.
    if (elegida.type !== "TOPIC") return { error: "Solo una tarjeta de tema puede ser la destacada." };
  }

  const cambios = new Map();
  const anotar = (id, campo, valor) => {
    if (!cambios.has(id)) cambios.set(id, { id });
    cambios.get(id)[campo] = valor;
  };

  orden.forEach((id, indice) => {
    if (porId.get(id).position !== indice) anotar(id, "position", indice);
  });

  for (const modulo of ordenables) {
    const debeEstar = modulo.id === destacada;
    if (modulo.isFeatured === debeEstar) continue;
    anotar(modulo.id, "isFeatured", debeEstar);
  }

  // Las que se apagan van primero: el índice parcial de la migración
  // (`ProfessionalHubModule_una_destacada_por_hub`) admite una sola destacada por
  // hub, y Postgres lo comprueba sentencia por sentencia. Encender antes de
  // apagar reventaría la transacción entera.
  const escrituras = [...cambios.values()].sort((a, b) => Number(a.isFeatured === true) - Number(b.isFeatured === true));
  return { escrituras };
}
