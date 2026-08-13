// src/actions/availability-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { requireProfessionalProfileId } from "@/lib/auth-guards";

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
    const rows = await prisma.availability.findMany({
      where: { professionalId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: { locations: { select: { locationId: true } } },
    });

    // `locationIds` vacío significa "todos mis lugares activos", que es el caso
    // de quien atiende siempre en el mismo sitio y no configuró nada.
    const data = rows.map(({ locations, ...block }) => ({
      ...block,
      locationIds: locations.map((link) => link.locationId),
    }));

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
        locationIds: Array.isArray(b.locationIds)
          ? [...new Set(b.locationIds.map((id) => String(id)).filter(Boolean))]
          : [],
      });
    }

    // Solo se aceptan lugares propios: así un bloque no puede quedar apuntando
    // al consultorio de otro profesional.
    const requestedLocationIds = [...new Set(normalized.flatMap((b) => b.locationIds))];
    if (requestedLocationIds.length > 0) {
      const owned = await prisma.practiceLocation.findMany({
        where: { id: { in: requestedLocationIds }, professionalId },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((loc) => loc.id));
      if (requestedLocationIds.some((id) => !ownedIds.has(id))) {
        return { success: false, error: "Uno de los lugares seleccionados no le pertenece." };
      }
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

      // Se crean uno por uno en vez de con createMany: hace falta el id de cada
      // bloque para colgarle sus lugares, y createMany no los devuelve.
      for (const { locationIds, ...block } of normalized) {
        const created = await tx.availability.create({ data: block, select: { id: true } });
        if (locationIds.length > 0) {
          await tx.availabilityLocation.createMany({
            data: locationIds.map((locationId) => ({ availabilityId: created.id, locationId })),
            skipDuplicates: true,
          });
        }
      }
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
