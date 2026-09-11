import { revalidatePath } from "next/cache";

/**
 * Revalida todas las páginas públicas que anuncian el precio de una consulta.
 *
 * Un precio aprobado tiene que verse igual en todos lados. Cada acción que lo
 * mueve —aprobar o rechazar una tarifa, una que se autoaprueba, borrar una,
 * aprobar una asignación— revalidaba su propia lista, y ninguna incluía el hub
 * de Raúl ni los hubs temáticos: el precio nuevo se veía en la ficha y el viejo
 * seguía hasta una hora en esas páginas. La lista vive acá para que una página
 * nueva con precio se agregue una sola vez.
 *
 * `/profesionales` y `/agendar/[id]` no figuran porque se renderizan en cada
 * visita.
 */
export function revalidarPreciosPublicos() {
  revalidatePath("/servicios");
  revalidatePath("/servicios/[slug]", "page");
  revalidatePath("/profesionales/[slug]", "page");
  // Hub de Raúl: la portada y el formato de 15 sesiones muestran el precio.
  revalidatePath("/raul-olmedo-evans");
  revalidatePath("/raul-olmedo-evans/tratamiento-breve-15-sesiones");
  // Hubs temáticos: listan los servicios y los profesionales con su rango.
  revalidatePath("/[slug]", "page");
}
