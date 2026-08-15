// src/actions/acuerdo-actions.js
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  CONTEXTOS,
  SELECT_ACUERDO,
  VERSION_ACUERDO,
  contextoPendiente,
  debeAceptarAcuerdo,
  invitacionARepasar,
} from "@/lib/acuerdo";

/** Huella mínima de la aceptación: dice quién y desde dónde, sin guardar de más. */
async function huella() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 512) || null,
  };
}

/**
 * Deja constancia de que una persona aceptó el acuerdo.
 *
 * Es la única función que escribe AceptacionAcuerdo, y lo hace en la misma
 * transacción que actualiza al usuario: si la fila no queda, la aceptación no
 * cuenta. Se exporta para reutilizarla desde el registro y desde la reserva de
 * la segunda cita, no solo desde la pantalla de repaso.
 *
 * @param {string} userId
 * @param {string} contexto - uno de CONTEXTOS
 * @param {{ip?: string|null, userAgent?: string|null}} [rastro]
 */
export async function anotarAceptacion(userId, contexto, rastro = {}) {
  const ahora = new Date();

  await prisma.$transaction([
    prisma.aceptacionAcuerdo.create({
      data: {
        userId,
        version: VERSION_ACUERDO,
        contexto,
        ip: rastro.ip || null,
        userAgent: rastro.userAgent || null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        acuerdoVersion: VERSION_ACUERDO,
        acuerdoAceptadoAt: ahora,
        // Aceptar cierra cualquier repaso pendiente: para eso se pidió.
        acuerdoPendienteDesde: null,
        acuerdoPendienteMotivo: null,
      },
    }),
  ]);
}

/**
 * ¿Le toca a esta persona aceptar o repasar el acuerdo?
 *
 * Lo consulta el componente de /terminos, que es una página pública y estática:
 * si esto se resolviera en el servidor de la página, habría que volverla
 * dinámica para todo el mundo solo por el puñado de gente que tiene un repaso
 * pendiente.
 */
export async function estadoDelAcuerdo() {
  const session = await getSession();
  if (!session || session.role !== "USER") return { debeAceptar: false };

  const user = await prisma.user.findUnique({
    where: { id: String(session.sub) },
    select: SELECT_ACUERDO,
  });

  if (!user || !debeAceptarAcuerdo(user)) return { debeAceptar: false };

  const contexto = contextoPendiente(user);
  const esRepaso = contexto !== CONTEXTOS.REGISTRO;

  return {
    debeAceptar: true,
    contexto,
    esRepaso,
    ...(esRepaso
      ? invitacionARepasar(contexto)
      : {
          titulo: "Falta tu confirmación",
          cuerpo:
            "Tu cuenta se creó antes de que este acuerdo existiera, o el texto cambió desde la " +
            "última vez. Confirmá que lo leíste para poder seguir reservando.",
          accion: "Leí y acepto el acuerdo",
        }),
  };
}

/**
 * La persona confirma que leyó. Se registra con el contexto que corresponda,
 * que lo decide el servidor: si lo eligiera el cliente, un repaso tras una
 * ausencia podría anotarse como si fuera el registro inicial.
 */
export async function confirmarAcuerdo() {
  const session = await getSession();
  if (!session || session.role !== "USER") return { error: "No autorizado." };

  const userId = String(session.sub);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: SELECT_ACUERDO,
  });
  if (!user) return { error: "No encontramos tu cuenta." };
  if (!debeAceptarAcuerdo(user)) return { success: true, yaEstaba: true };

  try {
    await anotarAceptacion(userId, contextoPendiente(user), await huella());
  } catch (error) {
    console.error("confirmarAcuerdo error:", error);
    return { error: "No pudimos registrar tu confirmación. Intentá de nuevo." };
  }

  revalidatePath("/panel/paciente");
  return { success: true };
}
