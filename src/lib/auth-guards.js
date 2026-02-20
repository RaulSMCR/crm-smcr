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

export async function requireProfessionalContext() {
  const session = await requireSession();
  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") {
    throw new Error("No autorizado: rol PROFESSIONAL requerido.");
  }
  const professionalProfileId = await requireProfessionalProfileId();
  return { session, professionalProfileId };
}
