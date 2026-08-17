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
 * Lo que visa son cierres administrativos, no expedientes: el expediente es de
 * la persona y de su profesional, y nunca pasa por esta base. Aun así se exige
 * colegiatura, porque decidir si un alta o una baja está bien documentada es un
 * juicio que solo tiene sentido desde el ejercicio profesional. Deliberadamente
 * no es un rol del enum: el rol operativo sigue siendo ADMIN, y un administrador
 * sin colegiatura no entra acá.
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
