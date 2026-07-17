"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

/**
 * Carga/actualiza el gasto publicitario de un canal para un mes.
 * Upsert por (source, month): reingresar el mismo canal-mes reemplaza el monto.
 */
export async function upsertChannelSpend(formData) {
  try {
    const session = await getSession();
    requireAdmin(session);

    const source = String(formData.get("source") || "").trim().toLowerCase().slice(0, 80);
    const month = String(formData.get("month") || "").trim(); // "YYYY-MM"
    const amount = Number(formData.get("amount"));

    if (!source) return { error: "Indicá el canal (utm_source)." };
    if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mes inválido (formato YYYY-MM)." };
    if (!Number.isFinite(amount) || amount < 0) return { error: "Monto inválido." };

    await prisma.channelSpend.upsert({
      where: { source_month: { source, month } },
      update: { amount },
      create: { source, month, amount },
    });

    revalidatePath("/panel/admin/marketing/atribucion");
    return { success: true };
  } catch (error) {
    console.error("upsertChannelSpend error:", error);
    return { error: "No se pudo guardar el gasto." };
  }
}

/** Elimina un registro de gasto por canal/mes. */
export async function deleteChannelSpend(id) {
  try {
    const session = await getSession();
    requireAdmin(session);
    const spendId = String(id || "");
    if (!spendId) return { error: "ID requerido." };
    await prisma.channelSpend.delete({ where: { id: spendId } });
    revalidatePath("/panel/admin/marketing/atribucion");
    return { success: true };
  } catch (error) {
    console.error("deleteChannelSpend error:", error);
    return { error: "No se pudo eliminar el gasto." };
  }
}
