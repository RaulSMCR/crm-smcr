// src/actions/exchange-rate-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { obtenerTipoCambio, registrarTipoCambioManual } from "@/lib/exchange-rate";

/** Estado actual del tipo de cambio y los últimos días registrados. */
export async function estadoTipoCambio() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado." };

  // Sin descarga: esta pantalla no debe quedarse esperando ocho segundos a un
  // servicio que probablemente esté bloqueado por ubicación.
  const [vigente, historial] = await Promise.all([
    obtenerTipoCambio({ permitirDescarga: false }),
    prisma.exchangeRate.findMany({ orderBy: { date: "desc" }, take: 10 }),
  ]);

  return {
    vigente: { ...vigente, rate: Number(vigente.rate) },
    historial: historial.map((r) => ({
      date: r.date,
      sell: Number(r.sell),
      buy: r.buy === null ? null : Number(r.buy),
      source: r.source,
    })),
  };
}

/** Guarda el tipo de cambio de hoy a mano. */
export async function guardarTipoCambio(formData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado." };

  const resultado = await registrarTipoCambioManual({
    sell: formData.get("sell"),
    buy: formData.get("buy"),
    fecha: formData.get("fecha") || undefined,
    createdBy: String(session.sub || ""),
  });

  if (resultado.error) return resultado;

  revalidatePath("/panel/admin/contabilidad");
  return { success: true, rate: resultado.rate };
}

/** Intenta la descarga automática, a pedido. */
export async function intentarDescargaTipoCambio() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { error: "No autorizado." };

  const antes = await obtenerTipoCambio({ permitirDescarga: false });
  const despues = await obtenerTipoCambio({ permitirDescarga: true });

  if (!despues.esDeHoy || despues.source === antes.source) {
    return {
      error:
        "No se pudo descargar. El BCCR y el indicador de Hacienda restringen el acceso por " +
        "ubicación geográfica, y las funciones corren fuera de Costa Rica. Cargá el valor a mano.",
    };
  }

  revalidatePath("/panel/admin/contabilidad");
  return { success: true, rate: Number(despues.rate), source: despues.source };
}
