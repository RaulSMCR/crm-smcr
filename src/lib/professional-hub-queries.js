import { prisma } from "@/lib/prisma";
import { HUB_PATH } from "@/lib/hub-raul";

const ADMIN_HUB_INCLUDE = {
  professional: {
    select: {
      id: true,
      slug: true,
      user: { select: { name: true, isActive: true } },
    },
  },
  modules: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
};

export async function listProfessionalHubsForAdmin() {
  return prisma.professionalHub.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      professional: { select: { slug: true, user: { select: { name: true, isActive: true } } } },
      _count: { select: { modules: true } },
    },
  });
}

export async function getProfessionalHubForAdmin(id) {
  return prisma.professionalHub.findUnique({ where: { id: String(id || "") }, include: ADMIN_HUB_INCLUDE });
}

export async function listProfessionalHubOptions() {
  return prisma.professionalProfile.findMany({
    where: { user: { is: { isActive: true } } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, user: { select: { name: true } } },
  });
}

/**
 * Slugs de hub profesional que hoy tienen una ruta que los renderiza.
 *
 * Las páginas del hub son carpetas literales en `src/app/`, no una ruta
 * dinámica: un hub publicado con otro slug se guarda bien, aparece en el panel
 * y su URL devuelve 404. Mientras eso siga así, esta lista es lo que evita que
 * la ficha enlace una página que no existe. Desaparece cuando el hub tenga
 * renderer genérico.
 */
const SLUGS_CON_RUTA = new Set([HUB_PATH]);

/**
 * Hub publicado de un perfil, para enlazarlo desde su ficha.
 *
 * Devuelve `null` si el hub está en borrador, archivado, inactivo o todavía sin
 * ruta: un enlace interno hacia un 404 gasta rastreo y le dice a Google que el
 * sitio no sabe qué publica.
 */
export async function getPublishedHubForProfile(profileSlug) {
  const slug = String(profileSlug || "");
  if (!slug) return null;
  try {
    const hub = await prisma.professionalHub.findFirst({
      where: { profileSlug: slug, status: "PUBLISHED", isActive: true },
      select: { slug: true, name: true, title: true },
    });
    return hub && SLUGS_CON_RUTA.has(hub.slug) ? hub : null;
  } catch {
    // La ficha se sirve igual sin el enlace; no es su contenido principal.
    return null;
  }
}
