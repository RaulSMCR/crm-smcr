// src/lib/mensajes.js
//
// Casilla de mensajes: resolución de destinatarios y lectura del buzón.
// Módulo de SERVIDOR.
//
// v1 segmenta por "todos" o por audiencia de frases. La segmentación por
// profesional y por servicio viene después; `resolverDestinatarios` está escrito
// para que agregarlas sea sumar ramas, no reescribir.
//
// Nota sobre las audiencias: solo 4 de las 8 pueden corresponder a alguien
// registrado (MR26, HR26, MRJ, HRJ). Las otras 4 son de no registrados y aquí
// devolverían siempre cero, así que el selector no debe ofrecerlas.

import { prisma } from "@/lib/prisma";
import { AUDIENCIAS_REGISTRADAS, audienciaDeUsuario } from "@/lib/frases-audiencia";

export const TIPOS_DESTINO = { ALL: "ALL", AUDIENCE: "AUDIENCE" };

/** Serializa/deserializa la lista de audiencias objetivo. */
export function serializarAudiencias(audiencias) {
  const limpias = [...new Set((audiencias || []).filter((a) => AUDIENCIAS_REGISTRADAS.includes(a)))];
  return limpias.length ? limpias.join(",") : null;
}

export function deserializarAudiencias(texto) {
  if (!texto) return [];
  return texto
    .split(",")
    .map((s) => s.trim())
    .filter((a) => AUDIENCIAS_REGISTRADAS.includes(a));
}

/**
 * Resuelve a quién le toca un mensaje.
 *
 * La audiencia se deriva en memoria y no en SQL porque es un valor calculado
 * (género normalizado + edad + reparto estable por hash) que no existe como
 * columna. A la escala actual es irrelevante; si la base crece mucho, el paso
 * siguiente es materializar la audiencia en User y filtrarla en la consulta.
 *
 * @returns {Promise<Array<{userId: string, audiencia: string|null}>>}
 */
export async function resolverDestinatarios({ targetKind, targetAudiences }) {
  const usuarios = await prisma.user.findMany({
    where: { role: "USER", isActive: true },
    select: { id: true, gender: true, birthDate: true },
  });

  if (targetKind === TIPOS_DESTINO.ALL) {
    return usuarios.map((u) => ({ userId: u.id, audiencia: null }));
  }

  const objetivo = new Set(
    Array.isArray(targetAudiences) ? targetAudiences : deserializarAudiencias(targetAudiences),
  );
  if (objetivo.size === 0) return [];

  const destinatarios = [];
  for (const u of usuarios) {
    const { audiencia } = audienciaDeUsuario(u);
    if (objetivo.has(audiencia)) destinatarios.push({ userId: u.id, audiencia });
  }
  return destinatarios;
}

/**
 * Cuántas personas alcanzaría un envío y cuántas de ellas tienen push activo.
 * Es la vista previa que evita disparar a ciegas.
 */
export async function previsualizarAlcance(destino) {
  const destinatarios = await resolverDestinatarios(destino);
  if (destinatarios.length === 0) return { total: 0, conPush: 0, porAudiencia: {} };

  const ids = destinatarios.map((d) => d.userId);
  const conPush = await prisma.pushSubscription.findMany({
    where: { userId: { in: ids } },
    select: { userId: true },
    distinct: ["userId"],
  });

  const porAudiencia = {};
  for (const d of destinatarios) {
    const clave = d.audiencia || "general";
    porAudiencia[clave] = (porAudiencia[clave] || 0) + 1;
  }

  return { total: destinatarios.length, conPush: conPush.length, porAudiencia };
}

/** Mensajes del buzón de un usuario, más recientes primero. */
export async function buzonDe(userId, limite = 30) {
  const filas = await prisma.adminMessageRecipient.findMany({
    where: { userId: String(userId), message: { status: "SENT" } },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      id: true,
      readAt: true,
      message: {
        select: { id: true, title: true, body: true, sentAt: true },
      },
    },
  });

  return filas.map((f) => ({
    receiptId: f.id,
    leido: Boolean(f.readAt),
    id: f.message.id,
    titulo: f.message.title,
    cuerpo: f.message.body,
    enviadoEl: f.message.sentAt,
  }));
}

/** Cuántos mensajes sin leer tiene un usuario (para el badge). */
export async function sinLeerDe(userId) {
  return prisma.adminMessageRecipient.count({
    where: { userId: String(userId), readAt: null, message: { status: "SENT" } },
  });
}
