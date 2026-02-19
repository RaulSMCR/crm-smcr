// src/lib/auth-guards.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function toStr(x) {
  if (x === undefined || x === null) return null;
  return String(x);
}

/**
 * Devuelve el ProfessionalProfile.id asociado a la sesión.
 * Orden:
 * 1) session.professionalProfileId
 * 2) session.userId / session.sub -> professionalProfile por userId
 * 3) session.email -> professionalProfile por user.email
 */
export async function requireProfessionalProfileId() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado: sesión requerida.");

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
