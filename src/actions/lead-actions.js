"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

const VALID_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "DISCARDED"];

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

/**
 * Cambia el estado de un lead y opcionalmente guarda una nota del admin.
 * Un solo clic desde la fila; la nota es opcional.
 */
export async function updateLeadStatus(leadId, status, adminNote) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const id = String(leadId || "");
    if (!id) return { error: "ID de lead requerido." };
    if (!VALID_STATUSES.includes(status)) return { error: "Estado inválido." };

    const data = { status };
    // undefined = no tocar la nota; string (incluido "") = actualizarla.
    if (adminNote !== undefined) {
      data.adminNote = String(adminNote).trim().slice(0, 2000) || null;
    }

    await prisma.lead.update({ where: { id }, data });

    revalidatePath("/panel/admin/leads");
    return { success: true };
  } catch (error) {
    console.error("updateLeadStatus error:", error);
    return { error: "No se pudo actualizar el lead." };
  }
}
