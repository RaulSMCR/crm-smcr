import { revalidatePath } from "next/cache";

/**
 * Rutas que hay que revalidar cuando cambia un hub profesional o uno de sus
 * módulos.
 *
 * Vive acá y no dentro de las server actions porque ahora hay dos escritores:
 * el formulario del panel y la ingesta de archivos `.md`. Con la lista copiada
 * en cada uno, el día que se agregue una ruta al hub una de las dos copias se
 * queda vieja y el contenido importado no aparece hasta el siguiente despliegue.
 */
export function revalidarHub(slug) {
  revalidatePath("/panel/admin/hubs");
  revalidatePath("/panel/admin/hubs/profesional/nuevo");
  revalidatePath("/panel/admin/hubs/profesional/[id]", "page");
  revalidatePath("/raul-olmedo-evans");
  revalidatePath("/raul-olmedo-evans/[tema]", "page");
  revalidatePath("/raul-olmedo-evans/tratamiento-breve-15-sesiones");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/${slug}`);
}
