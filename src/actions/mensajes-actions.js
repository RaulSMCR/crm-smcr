"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendPushToUsers } from "@/lib/push/send";
import { AUDIENCIAS_REGISTRADAS } from "@/lib/frases-audiencia";
import {
  TIPOS_DESTINO,
  opcionesDeSegmentacion,
  previsualizarAlcance,
  resolverDestinatarios,
  serializarAudiencias,
} from "@/lib/mensajes";
import { VENTANAS, describirFiltro, listaDe, serializarLista } from "@/lib/mensajes-filtro";

function requireAdmin(session) {
  if (!session || session.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
}

function revalidarMensajes() {
  revalidatePath("/panel/admin/mensajes");
  revalidatePath("/panel/admin");
  revalidatePath("/mi");
  revalidatePath("/mi/mensajes");
}

const VENTANAS_VALIDAS = new Set([VENTANAS.UPCOMING, VENTANAS.PAST, VENTANAS.ANY]);

function limpiarDestino(entrada = {}) {
  const { tipo, audiencias, profesionales, servicios, ventana, ventanaDias } = entrada;

  const targetKind = tipo === TIPOS_DESTINO.AUDIENCE ? TIPOS_DESTINO.AUDIENCE : TIPOS_DESTINO.ALL;
  const lista = (audiencias || []).filter((a) => AUDIENCIAS_REGISTRADAS.includes(a));

  const dias = Number(ventanaDias);
  return {
    targetKind,
    targetAudiences: targetKind === TIPOS_DESTINO.AUDIENCE ? lista : [],
    targetProfessionals: listaDe(profesionales),
    targetServices: listaDe(servicios),
    targetWindow: VENTANAS_VALIDAS.has(ventana) ? ventana : VENTANAS.ANY,
    targetWindowDays: Number.isFinite(dias) && dias > 0 && dias <= 365 ? Math.floor(dias) : null,
    targetIncludeCancelled: Boolean(entrada.incluirCanceladas),
    targetNegate: Boolean(entrada.negar),
  };
}

/** Vista previa del alcance antes de enviar. No escribe nada. */
export async function previsualizarMensaje(entrada) {
  requireAdmin(await getSession());
  const destino = limpiarDestino(entrada);
  if (destino.targetKind === TIPOS_DESTINO.AUDIENCE && destino.targetAudiences.length === 0) {
    return { total: 0, conPush: 0, porAudiencia: {}, aviso: "No hay audiencias seleccionadas." };
  }

  const alcance = await previsualizarAlcance(destino);
  const { profesionales, servicios } = await opcionesDeSegmentacion();
  return {
    ...alcance,
    descripcion: describirFiltro(
      {
        profesionales: destino.targetProfessionals,
        servicios: destino.targetServices,
        ventana: destino.targetWindow,
        ventanaDias: destino.targetWindowDays,
        incluirCanceladas: destino.targetIncludeCancelled,
        negar: destino.targetNegate,
      },
      {
        profesionales: Object.fromEntries(profesionales.map((p) => [p.id, p.nombre])),
        servicios: Object.fromEntries(servicios.map((s) => [s.id, s.nombre])),
      },
    ),
  };
}

/** Profesionales y servicios elegibles para segmentar, con su volumen de citas. */
export async function obtenerOpcionesDeSegmentacion() {
  requireAdmin(await getSession());
  return opcionesDeSegmentacion();
}

/**
 * Crea y envía un mensaje. El reparto se materializa en el momento del envío:
 * una fila por destinatario, que además es donde vive el acuse de lectura.
 * Congelarlo es deliberado — si alguien edita su perfil después, no se le quita
 * un mensaje que ya recibió.
 */
export async function enviarMensaje(entrada = {}) {
  const session = await getSession();
  requireAdmin(session);

  const { titulo, cuerpo, conPush = true } = entrada;
  const title = String(titulo || "").trim();
  const body = String(cuerpo || "").trim();
  if (title.length < 3) return { error: "El título debe tener al menos 3 caracteres." };
  if (body.length < 3) return { error: "El mensaje no puede ir vacío." };
  if (title.length > 160) return { error: "El título no puede pasar de 160 caracteres." };

  const destino = limpiarDestino(entrada);
  if (destino.targetKind === TIPOS_DESTINO.AUDIENCE && destino.targetAudiences.length === 0) {
    return { error: "Elegí al menos una audiencia." };
  }

  const destinatarios = await resolverDestinatarios(destino);
  if (destinatarios.length === 0) {
    return { error: "Ese filtro no alcanza a ninguna persona. El mensaje no se envió." };
  }

  const mensaje = await prisma.$transaction(async (tx) => {
    const creado = await tx.adminMessage.create({
      data: {
        title,
        body,
        targetKind: destino.targetKind,
        targetAudiences: serializarAudiencias(destino.targetAudiences),
        targetProfessionals: serializarLista(destino.targetProfessionals),
        targetServices: serializarLista(destino.targetServices),
        targetWindow: destino.targetWindow,
        targetWindowDays: destino.targetWindowDays,
        targetIncludeCancelled: destino.targetIncludeCancelled,
        targetNegate: destino.targetNegate,
        status: "SENT",
        sentAt: new Date(),
        recipientCount: destinatarios.length,
        createdBy: String(session.sub),
      },
    });

    await tx.adminMessageRecipient.createMany({
      data: destinatarios.map((d) => ({
        messageId: creado.id,
        userId: d.userId,
        audience: d.audiencia,
      })),
      skipDuplicates: true,
    });

    return creado;
  });

  // El push va fuera de la transacción: es un efecto externo y su fallo no debe
  // deshacer un mensaje que ya está en los buzones.
  let pushSent = 0;
  if (conPush) {
    const r = await sendPushToUsers(
      destinatarios.map((d) => d.userId),
      { title, body: body.slice(0, 160), url: "/mi/mensajes" },
    );
    pushSent = r.sent || 0;
    if (pushSent > 0) {
      await prisma.adminMessage.update({
        where: { id: mensaje.id },
        data: { pushSent },
      });
    }
  }

  revalidarMensajes();
  return { success: true, id: mensaje.id, destinatarios: destinatarios.length, pushSent };
}

/** Marca un mensaje como leído. Lo invoca el usuario desde su buzón. */
export async function marcarLeido(messageId) {
  const session = await getSession();
  if (!session) return { error: "No autorizado." };

  // updateMany con userId en el where: nadie puede marcar el mensaje de otro.
  await prisma.adminMessageRecipient.updateMany({
    where: { messageId: String(messageId || ""), userId: String(session.sub), readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/mi/mensajes");
  revalidatePath("/mi");
  return { success: true };
}

/** Borra un mensaje enviado y todos sus acuses. Solo admin. */
export async function eliminarMensaje(messageId) {
  requireAdmin(await getSession());
  await prisma.adminMessage.delete({ where: { id: String(messageId || "") } }).catch(() => {});
  revalidarMensajes();
  return { success: true };
}
