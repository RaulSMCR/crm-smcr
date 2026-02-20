// src/actions/patient-profile-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/actions/auth-actions";

function s(v) {
  return String(v ?? "").trim();
}

function normalizePhone(v) {
  return s(v).replace(/\s+/g, " ");
}

function isPhoneValid(v) {
  if (!v) return false;
  if (!/^[+0-9()\-\s]+$/.test(v)) return false;
  const digits = (v.match(/\d/g) || []).length;
  return digits >= 8;
}

export async function updatePatientProfile(formData) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Debes iniciar sesión." };
    if (session.role !== "USER") return { success: false, error: "No autorizado." };

    const userId = String(session.sub);

    const name = s(formData.get("name"));
    const phone = normalizePhone(formData.get("phone"));
    const identification = s(formData.get("identification"));
    const birthDateRaw = s(formData.get("birthDate")); // YYYY-MM-DD
    const gender = s(formData.get("gender"));
    const interests = s(formData.get("interests"));

    if (!name) return { success: false, error: "El nombre es obligatorio." };
    if (!phone) return { success: false, error: "El teléfono es obligatorio." };
    if (!isPhoneValid(phone)) return { success: false, error: "Teléfono inválido." };

    let birthDate = null;
    if (birthDateRaw) {
      const d = new Date(birthDateRaw);
      if (Number.isNaN(d.getTime())) return { success: false, error: "Fecha de nacimiento inválida." };
      birthDate = d; // DateTime-friendly
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        identification: identification || null,
        birthDate: birthDate || null,
        gender: gender || null,
        interests: interests || null,
      },
    });

    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (e) {
    console.error("updatePatientProfile error:", e);
    return { success: false, error: "No se pudo actualizar tu perfil." };
  }
}
