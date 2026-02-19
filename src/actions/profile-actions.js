// src/actions/profile-actions.js
'use server';

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function toStr(x) {
  if (x === undefined || x === null) return "";
  return String(x);
}

function normalizePhone(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

function isPhoneValid(v) {
  const s = normalizePhone(v);
  if (!s) return false;
  if (!/^[+0-9()\-\s]+$/.test(s)) return false;
  const digits = (s.match(/\d/g) || []).length;
  return digits >= 8;
}

async function requireProfessionalProfileId() {
  const session = await getSession();
  if (!session) return { error: "No autorizado: sesión requerida." };

  const role = toStr(session.role);
  if (role !== "PROFESSIONAL") return { error: "No autorizado: rol PROFESSIONAL requerido." };

  const profId =
    toStr(session.professionalProfileId) ||
    toStr(session.professionalId); // compat si quedó algo viejo en tokens

  if (profId) return { session, professionalProfileId: profId };

  const userId = toStr(session.userId) || toStr(session.sub);
  if (userId) {
    const prof = await prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (prof?.id) return { session, professionalProfileId: prof.id };
  }

  return { error: "No se encontró el perfil profesional asociado a esta sesión." };
}

/**
 * ACTUALIZAR PERFIL COMPLETO
 * - User: name, image (y opcional phone)
 * - ProfessionalProfile: specialty, licenseNumber, bio
 * - Services: set([...])
 */
export async function updateProfile(formData) {
  try {
    const guard = await requireProfessionalProfileId();
    if (guard.error) return { success: false, error: guard.error };

    const { session, professionalProfileId } = guard;

    const name = toStr(formData.get("name")).trim();
    const phoneRaw = formData.get("phone");
    const phone = normalizePhone(phoneRaw);

    const specialty = toStr(formData.get("specialty")).trim();
    const licenseNumber = toStr(formData.get("licenseNumber")).trim() || null;
    const bio = toStr(formData.get("bio")).trim() || null;
    const imageUrl = toStr(formData.get("imageUrl")).trim() || null;

    if (!name) return { success: false, error: "El nombre es obligatorio." };
    if (!specialty) return { success: false, error: "La especialidad es obligatoria." };

    if (phoneRaw !== null && phoneRaw !== undefined) {
      if (!phone) return { success: false, error: "El teléfono es obligatorio." };
      if (!isPhoneValid(phone)) return { success: false, error: "Teléfono inválido." };
    }

    const serviceIds = (formData.getAll("serviceIds") || [])
      .map((x) => toStr(x))
      .filter(Boolean);

    await prisma.professionalProfile.update({
      where: { id: professionalProfileId },
      data: {
        specialty,
        licenseNumber,
        bio,
        user: {
          update: {
            name,
            ...(phoneRaw !== null && phoneRaw !== undefined ? { phone } : {}),
            ...(imageUrl ? { image: imageUrl } : {}),
          },
        },
        services: {
          set: serviceIds.map((id) => ({ id })),
        },
      },
    });

    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional");
    if (session?.slug) revalidatePath(`/profesionales/${session.slug}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { success: false, error: "Error al actualizar perfil. Intenta nuevamente." };
  }
}
