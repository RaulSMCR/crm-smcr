// src/actions/profile-actions.js
'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireProfessionalContext } from "@/lib/auth-guards";

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

/**
 * ACTUALIZAR PERFIL COMPLETO
 * - User: name, image (y opcional phone)
 * - ProfessionalProfile: specialty, licenseNumber, bio
 * - Services: set([...])
 */
export async function updateProfile(formData) {
  try {
    const { session, professionalProfileId } = await requireProfessionalContext();

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

    // Si es un error de guard (auth), podés devolver el mensaje tal cual:
    const msg = String(error?.message ?? "");
    if (msg.startsWith("No autorizado") || msg.includes("perfil profesional")) {
      return { success: false, error: msg };
    }

    return { success: false, error: "Error al actualizar perfil. Intenta nuevamente." };
  }
}
