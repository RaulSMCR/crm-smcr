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

function overlaps(a, b) {
  // HH:mm lexicográfico funciona
  return a.startTime < b.endTime && b.startTime < a.endTime;
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
    return {
      success: false,
      data: [],
      error: "No se pudieron cargar horarios.",
      details: String(err?.message ?? err),
    };
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

    // 1) Normalizar + dedupe exactos
    const seen = new Set();
    const normalized = [];

    for (const b of payload) {
      const v = validateBlock(b);
      if (!v.ok) return { success: false, error: v.error };

      const key = `${v.dayOfWeek}|${v.startTime}|${v.endTime}`;
      if (seen.has(key)) continue; // ignoramos duplicados exactos
      seen.add(key);

      normalized.push({
        professionalId,
        dayOfWeek: v.dayOfWeek,
        startTime: v.startTime,
        endTime: v.endTime,
      });
    }

    // 2) Validar solapamientos por día
    const byDay = new Map();
    for (const b of normalized) {
      if (!byDay.has(b.dayOfWeek)) byDay.set(b.dayOfWeek, []);
      byDay.get(b.dayOfWeek).push(b);
    }

    for (const [day, blocks] of byDay.entries()) {
      blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < blocks.length; i++) {
        const prev = blocks[i - 1];
        const curr = blocks[i];
        if (overlaps(prev, curr)) {
          return {
            success: false,
            error: `Bloques solapados en día ${day}: ${prev.startTime}-${prev.endTime} y ${curr.startTime}-${curr.endTime}.`,
          };
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.availability.deleteMany({ where: { professionalId } });
      await tx.availability.createMany({
        data: normalized,
        skipDuplicates: true,
      });
    });

    return { success: true };
  } catch (err) {
    console.error("Error saving availability:", err);
    return {
      success: false,
      error: "Error interno al guardar",
      details: String(err?.message ?? err),
    };
  }
}
