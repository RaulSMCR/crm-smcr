// src/lib/auth-guards.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function toStr(x) {
  if (x === undefined || x === null) return null;
  return String(x);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado: sesión requerida.");
  return session;
}

export async function requireProfessionalProfileId() {
  const session = await requireSession();
  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") {
    throw new Error("No autorizado: rol PROFESSIONAL requerido.");
  }

  const profId = toStr(session.professionalProfileId);
  if (profId) return profId;

  const userId = toStr(session.userId) || toStr(session.sub);
  if (userId) {
    const prof = await prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (prof?.id) return prof.id;
  }

  const email = toStr(session.email);
  if (email) {
    const prof = await prisma.professionalProfile.findFirst({
      where: { user: { email } },
      select: { id: true },
    });
    if (prof?.id) return prof.id;
  }

  throw new Error("No se encontró el perfil profesional asociado a esta sesión.");
}

/**
 * Dirección clínica: quien puede leer y visar los cierres de los casos.
 *
 * Deliberadamente no es un rol del enum. Lo que habilita a abrir un expediente
 * no es el puesto en la plataforma sino la colegiatura: el Código de Ética y
 * Deontológico del CPPCR solo admite compartir con autorización expresa de la
 * persona usuaria (art. 33), y esa autorización —la que da el acuerdo al
 * registrarse— se otorga a una dirección clínica profesional, no a "el
 * administrador del sistema". Por eso se exigen las dos cosas, y sin número de
 * colegiado no hay acceso aunque la cuenta sea ADMIN.
 *
 * @returns {Promise<{session: object, director: {id: string, name: string, colegiadoNumero: string}}>}
 */
export async function requireClinicalDirector() {
  const session = await requireSession();
  const userId = toStr(session.userId) || toStr(session.sub);
  if (!userId) throw new Error("No autorizado: sesión sin usuario.");

  const director = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      clinicalDirectorSince: true,
      colegiadoNumero: true,
      colegiadoColegio: true,
    },
  });

  if (!director?.clinicalDirectorSince || !director.colegiadoNumero) {
    throw new Error("No autorizado: se requiere dirección clínica con colegiatura registrada.");
  }

  return { session, director };
}

/** Versión que no lanza, para decidir si mostrar un enlace en el menú. */
export async function esDireccionClinica() {
  try {
    await requireClinicalDirector();
    return true;
  } catch {
    return false;
  }
}

export async function requireProfessionalContext() {
  const session = await requireSession();
  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") {
    throw new Error("No autorizado: rol PROFESSIONAL requerido.");
  }
  const professionalProfileId = await requireProfessionalProfileId();
  return { session, professionalProfileId };
}
