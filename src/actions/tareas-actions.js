"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hoyCR, CADENCIAS } from "@/lib/tareas-sostenidas";

const CADENCIAS_VALIDAS = new Set(Object.values(CADENCIAS));

async function requerirAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("No autorizado.");
  return session;
}

/** `YYYY-MM-DD` → Date a mediodía UTC, para que la columna DATE no se corra un día. */
function aFecha(iso) {
  return new Date(`${iso}T12:00:00.000Z`);
}

/**
 * Marca o desmarca una tarea del día.
 *
 * `upsert` sobre `(fecha, clave)`: marcar dos veces la misma tarea actualiza en
 * vez de duplicar, y desmarcar deja la fila con `completado: false` en lugar de
 * borrarla — que alguien haya marcado y desmarcado es información.
 */
export async function marcarTarea({ clave, cadencia, completado, nota, datos, fecha }) {
  try {
    await requerirAdmin();

    const k = String(clave || "").trim();
    if (!k) return { error: "Falta la tarea." };
    if (!CADENCIAS_VALIDAS.has(cadencia)) return { error: "Cadencia desconocida." };

    const dia = aFecha(fecha || hoyCR());
    const comun = {
      completado: Boolean(completado),
      nota: String(nota || "").trim() || null,
      datos: datos ?? undefined,
    };

    await prisma.taskLog.upsert({
      where: { fecha_clave: { fecha: dia, clave: k } },
      update: comun,
      create: { fecha: dia, clave: k, cadencia, ...comun },
    });

    revalidatePath("/panel/admin/tareas");
    return { ok: true };
  } catch (error) {
    console.error("[marcarTarea]", error);
    return { error: "No se pudo guardar." };
  }
}

/** Registra un contacto de outreach y marca la tarea diaria del mismo golpe. */
export async function registrarContacto({ destinatario, canal, pedido, seguimiento }) {
  try {
    await requerirAdmin();

    const quien = String(destinatario || "").trim();
    if (!quien) return { error: "Indicá a quién contactaste." };

    const hoy = hoyCR();
    await prisma.outreachLog.create({
      data: {
        fecha: aFecha(hoy),
        destinatario: quien.slice(0, 200),
        canal: String(canal || "").trim().slice(0, 40) || null,
        pedido: String(pedido || "").trim() || null,
        seguimiento: seguimiento ? aFecha(seguimiento) : null,
      },
    });

    // La tarea diaria se marca sola: pedirle a alguien que registre el contacto
    // y ADEMÁS tilde una casilla es pedirle que diga lo mismo dos veces.
    await prisma.taskLog.upsert({
      where: { fecha_clave: { fecha: aFecha(hoy), clave: "contacto" } },
      update: { completado: true, nota: quien.slice(0, 200) },
      create: { fecha: aFecha(hoy), clave: "contacto", cadencia: CADENCIAS.DIARIA, completado: true, nota: quien.slice(0, 200) },
    });

    revalidatePath("/panel/admin/tareas");
    return { ok: true };
  } catch (error) {
    console.error("[registrarContacto]", error);
    return { error: "No se pudo registrar el contacto." };
  }
}

/** Actualiza el resultado de un contacto: respondió, publicó, o no contestó. */
export async function actualizarContacto({ id, resultado, urlMencion }) {
  try {
    await requerirAdmin();
    const validos = ["pendiente", "respondio", "publicado", "sin_respuesta"];
    if (!validos.includes(resultado)) return { error: "Resultado desconocido." };

    await prisma.outreachLog.update({
      where: { id: String(id) },
      data: {
        resultado,
        urlMencion: String(urlMencion || "").trim() || null,
      },
    });

    revalidatePath("/panel/admin/tareas");
    return { ok: true };
  } catch (error) {
    console.error("[actualizarContacto]", error);
    return { error: "No se pudo actualizar." };
  }
}
