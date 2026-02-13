// src/actions/availability-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function toStr(x) {
  if (x === undefined || x === null) return null;
  return String(x);
}

async function requireProfessionalProfileId() {
  const session = await getSession();
  if (!session) throw new Error("No autorizado: sesión requerida.");

  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") throw new Error("No autorizado: rol PROFESSIONAL requerido.");

  // 1) Ideal: viene en sesión (por login)
  const profId = toStr(session.professionalProfileId);
  if (profId) return profId;

  // 2) Fallback por userId/sub (si alguien manipula el token viejo, igual funciona)
  const userId = toStr(session.userId) || toStr(session.sub);
  if (userId) {
    const prof = await prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (prof?.id) return prof.id;
  }

  // 3) Fallback por email
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

function validateBlock(b) {
  const dayOfWeek = Number(b.dayOfWeek);
  const startTime = String(b.startTime);
  const endTime = String(b.endTime);

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { ok: false, error: `Día inválido (${b.dayOfWeek}). Usa 0..6.` };
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { ok: false, error: "Hora inválida. Usa HH:mm (ej: 09:00)." };
  }
  if (endTime <= startTime) {
    return { ok: false, error: "La hora fin debe ser mayor que la hora inicio." };
  }
  return { ok: true, dayOfWeek, startTime, endTime };
}

export async function getAvailability() {
  try {
    const professionalId = await requireProfessionalProfileId();
    const data = await prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return { success: true, data };
  } catch (err) {
    console.error("Error getting availability:", err);
    return { success: false, data: [], error: "No se pudieron cargar horarios.", details: String(err?.message ?? err) };
  }
}

export async function updateAvailability(payload) {
  try {
    const professionalId = await requireProfessionalProfileId();

    if (!Array.isArray(payload)) {
      return { success: false, error: "Formato inválido: se esperaba un arreglo." };
    }

    if (payload.length === 0) {
      await prisma.availability.deleteMany({ where: { professionalId } });
      return { success: true };
    }

    const normalized = [];
    for (const b of payload) {
      const v = validateBlock(b);
      if (!v.ok) return { success: false, error: v.error };
      normalized.push({
        professionalId,
        dayOfWeek: v.dayOfWeek,
        startTime: v.startTime,
        endTime: v.endTime,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.availability.deleteMany({ where: { professionalId } });
      await tx.availability.createMany({ data: normalized });
    });

    return { success: true };
  } catch (err) {
    console.error("Error saving availability:", err);
    return { success: false, error: "Error interno al guardar", details: String(err?.message ?? err) };
  }
}
