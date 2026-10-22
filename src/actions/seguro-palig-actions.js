"use server";

// src/actions/seguro-palig-actions.js
// Admin → Seguros: marcar o quitar el seguro PALIG de un paciente.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, isPreviewSession, PREVIEW_BLOCKED_MESSAGE } from "@/lib/auth";
import { marcarSeguroPalig, quitarSeguro } from "@/lib/seguro-palig";

async function soloAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return "No autorizado.";
  if (isPreviewSession(session)) return PREVIEW_BLOCKED_MESSAGE;
  return null;
}

function revalidar() {
  revalidatePath("/panel/admin/seguros");
  revalidatePath("/panel/palig");
  revalidatePath("/panel/paciente");
}

export async function marcarSeguroPaligAction(patientId) {
  const error = await soloAdmin();
  if (error) return { success: false, error };
  try {
    const r = await marcarSeguroPalig(prisma, patientId);
    if (!r.ok) return { success: false, error: r.message };
    revalidar();
    return { success: true };
  } catch (fallo) {
    console.error("marcarSeguroPaligAction error:", fallo);
    return { success: false, error: "No se pudo marcar el seguro." };
  }
}

export async function quitarSeguroAction(patientId) {
  const error = await soloAdmin();
  if (error) return { success: false, error };
  try {
    const r = await quitarSeguro(prisma, patientId);
    if (!r.ok) return { success: false, error: r.message };
    revalidar();
    return { success: true };
  } catch (fallo) {
    console.error("quitarSeguroAction error:", fallo);
    return { success: false, error: "No se pudo quitar el seguro." };
  }
}
