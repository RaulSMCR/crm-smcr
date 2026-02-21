// src/actions/patient-profile-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";

const s = (v) => String(v ?? "").trim();

function isPhoneValid(v) {
  const phone = s(v);
  if (!phone) return false;
  if (!/^[+0-9()\-\s]+$/.test(phone)) return false;
  const digits = (phone.match(/\d/g) || []).length;
  return digits >= 8;
}

function isIdentificationValid(v) {
  const id = s(v);
  if (!id) return false;
  if (!/^[A-Za-z0-9.\-\s]+$/.test(id)) return false;
  const compact = id.replace(/\s+/g, "");
  return compact.length >= 5 && compact.length <= 32;
}

export async function updatePatientProfile(formData) {
  const session = await getSession();
  if (!session) return { error: "No autenticado." };
  if (session.role !== "USER") return { error: "No autorizado." };

  const userId = String(session.userId || session.sub);

  const name = s(formData.get("name"));
  const phone = s(formData.get("phone"));
  const identification = s(formData.get("identification"));
  const birthDateRaw = s(formData.get("birthDate"));
  const gender = s(formData.get("gender")) || null;
  const interests = s(formData.get("interests")) || null;

  if (!name) return { error: "El nombre es obligatorio." };
  if (!phone) return { error: "El teléfono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "Teléfono inválido (mínimo 8 dígitos)." };

  // obligatoria a nivel app
  if (!identification) return { error: "La identificación es obligatoria." };
  if (!isIdentificationValid(identification)) return { error: "Identificación inválida." };

  let birthDate = null;
  if (birthDateRaw) {
    const d = new Date(birthDateRaw);
    if (Number.isNaN(d.getTime())) return { error: "Fecha de nacimiento inválida." };
    birthDate = d;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        identification: identification || null,
        birthDate,
        gender,
        interests,
      },
    });

    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (e) {
    console.error("updatePatientProfile error:", e);
    return { error: "No se pudo guardar. Intenta de nuevo." };
  }
}
