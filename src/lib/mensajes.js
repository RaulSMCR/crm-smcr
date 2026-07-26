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
import { construirFiltroDeCitas, tieneFiltroDeCitas } from "@/lib/mensajes-filtro";

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
 * Resuelve a quién le toca un mensaje: intersección del conjunto base
 * (todos, o los de ciertas audiencias) con el filtro de citas, que además
 * puede negarse.
 *
 * La audiencia se deriva en memoria y no en SQL porque es un valor calculado
 * (género normalizado + edad + reparto estable por hash) que no existe como
 * columna. A la escala actual es irrelevante; si la base crece mucho, el paso
 * siguiente es materializar la audiencia en User y filtrarla en la consulta.
 * El filtro de citas sí va en SQL: Appointment indexa professionalId,
 * serviceId, status y date.
 *
 * @returns {Promise<Array<{userId: string, audiencia: string|null}>>}
 */
export async function resolverDestinatarios(destino = {}, ahora = new Date()) {
  const {
    targetKind,
    targetAudiences,
    targetProfessionals,
    targetServices,
    targetWindow,
    targetWindowDays,
    targetIncludeCancelled,
    targetNegate,
  } = destino;

  const usuarios = await prisma.user.findMany({
    where: { role: "USER", isActive: true },
    select: { id: true, gender: true, birthDate: true },
  });

  // 1. Conjunto base.
  let base;
  if (targetKind === TIPOS_DESTINO.AUDIENCE) {
    const objetivo = new Set(
      Array.isArray(targetAudiences) ? targetAudiences : deserializarAudiencias(targetAudiences),
    );
    if (objetivo.size === 0) return [];
    base = [];
    for (const u of usuarios) {
      const { audiencia } = audienciaDeUsuario(u);
      if (objetivo.has(audiencia)) base.push({ userId: u.id, audiencia });
    }
  } else {
    base = usuarios.map((u) => ({ userId: u.id, audiencia: null }));
  }

  // 2. Filtro de citas, si lo hay.
  const criterios = {
    profesionales: targetProfessionals,
    servicios: targetServices,
    ventana: targetWindow,
    ventanaDias: targetWindowDays,
    incluirCanceladas: targetIncludeCancelled,
  };
  if (!tieneFiltroDeCitas(criterios)) return base;

  const where = construirFiltroDeCitas(criterios, ahora);
  const citas = await prisma.appointment.findMany({
    where,
    select: { patientId: true },
    distinct: ["patientId"],
  });
  const conCita = new Set(citas.map((c) => c.patientId));

  // 3. Intersección, o su complemento si el filtro va negado.
  return targetNegate
    ? base.filter((d) => !conCita.has(d.userId))
    : base.filter((d) => conCita.has(d.userId));
}

/**
 * Cuántas personas alcanzaría un envío y cuántas de ellas tienen push activo.
 * Es la vista previa que evita disparar a ciegas.
 */
export async function previsualizarAlcance(destino) {
  const destinatarios = await resolverDestinatarios(destino);
  const base = await prisma.user.count({ where: { role: "USER", isActive: true } });

  if (destinatarios.length === 0) return { total: 0, conPush: 0, porAudiencia: {}, base };

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

  return { total: destinatarios.length, conPush: conPush.length, porAudiencia, base };
}

/**
 * Profesionales y servicios disponibles para segmentar, con cuántos pacientes
 * distintos tiene cada uno. El conteo evita que el admin elija a ciegas un
 * profesional sin cartera.
 */
export async function opcionesDeSegmentacion() {
  const profesionales = await prisma.professionalProfile.findMany({
    where: { isApproved: true },
    select: { id: true, specialty: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const servicios = await prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
    orderBy: { displayOrder: "asc" },
  });

  const porProfesional = await prisma.appointment.groupBy({
    by: ["professionalId"],
    _count: { _all: true },
  });
  const porServicio = await prisma.appointment.groupBy({
    by: ["serviceId"],
    _count: { _all: true },
  });

  const citasPro = new Map(porProfesional.map((r) => [r.professionalId, r._count._all]));
  const citasSvc = new Map(porServicio.map((r) => [r.serviceId, r._count._all]));

  return {
    profesionales: profesionales.map((p) => ({
      id: p.id,
      nombre: p.user?.name || "Sin nombre",
      especialidad: p.specialty,
      citas: citasPro.get(p.id) || 0,
    })),
    servicios: servicios.map((s) => ({
      id: s.id,
      nombre: s.title,
      citas: citasSvc.get(s.id) || 0,
    })),
  };
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
