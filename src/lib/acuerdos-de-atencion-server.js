// src/lib/acuerdos-de-atencion-server.js
//
// Lo que un acuerdo de atención hace con la base y con Google. Las fechas y las
// reglas viven en `acuerdos-de-atencion.js`, que es puro; acá solo se aplican.
//
// Qué NO pasa con una cita de acuerdo, a diferencia de una reserva común:
//   • no se cobra adelanto ni entra en la escalera de precios (no es paciente
//     nuevo) y ningún cobro de ONVO se le genera (ver payment-requests.js);
//   • no se manda el correo de «cita agendada»: el paciente recibió UNA
//     invitación, la del evento recurrente;
//   • no tiene evento propio en Google: apunta a su instancia dentro de la serie.
// Los recordatorios de 24 h y 1 h sí salen, programados por día (ver
// diaQueProgramaLaTarea).
//
// Las dependencias externas (Google, QStash, apertura del caso) entran por
// `deps` para poder probar esto sin red; por defecto son las reales.

import { getCalendarClient } from "@/lib/google";
import { scheduleReminder } from "@/lib/qstash";
import { abrirCasoSiNoExiste } from "@/lib/casos";
import { isAppointmentOverlapError } from "@/lib/appointment-errors";
import { DEFAULT_TZ, toGoogleDateTime } from "@/lib/timezone";
import { instanteDeHoraCR, crAddDays } from "@/lib/appointment-slots";
import {
  ESTADOS_ACUERDO,
  diaQueProgramaLaTarea,
  diasQueProgramaLaCreacion,
  idDeSesionEnGoogle,
  problemaDeAcuerdo,
  puedeGestionarAcuerdos,
  reglaDeGoogle,
  sesionesDelAcuerdo,
  ventanaPendiente,
} from "@/lib/acuerdos-de-atencion";

const TZ = process.env.APP_TIMEZONE || DEFAULT_TZ;
const ESTADOS_VIGENTES = ["PENDING", "CONFIRMED"];

function falla(status, message, code) {
  return { ok: false, status, message, code };
}

const SELECT_ACUERDO_COMPLETO = {
  id: true, patientId: true, professionalId: true, serviceId: true,
  locationId: true, modality: true, locationName: true,
  periodicidad: true, inicio: true, duracionMin: true, fin: true,
  precioAcordado: true, estado: true, gcalEventId: true, meetLink: true, generadoHasta: true,
  patient: { select: { name: true, email: true } },
  service: { select: { title: true } },
  professional: { select: { googleRefreshToken: true, googleCalendarId: true, user: { select: { name: true, email: true } } } },
};

// ─── Google ──────────────────────────────────────────────────────────────────

function eventoRecurrente(acuerdo) {
  const inicio = new Date(acuerdo.inicio);
  const fin = new Date(inicio.getTime() + acuerdo.duracionMin * 60_000);
  return {
    summary: `${acuerdo.service?.title || "Consulta"} - ${acuerdo.patient?.name || "Paciente"}`,
    description: [
      "Acuerdo de atención (sesiones recurrentes)",
      `Paciente: ${acuerdo.patient?.name || "N/D"}`,
      acuerdo.patient?.email ? `Email paciente: ${acuerdo.patient.email}` : null,
      `Profesional: ${acuerdo.professional?.user?.name || "N/D"}`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: toGoogleDateTime(inicio, TZ), timeZone: TZ },
    end: { dateTime: toGoogleDateTime(fin, TZ), timeZone: TZ },
    recurrence: reglaDeGoogle(acuerdo),
    attendees: [
      acuerdo.patient?.email ? { email: acuerdo.patient.email, displayName: acuerdo.patient.name || "Paciente" } : null,
      acuerdo.professional?.user?.email
        ? { email: acuerdo.professional.user.email, displayName: acuerdo.professional.user.name || "Profesional" }
        : null,
    ].filter(Boolean),
    // Una sola sala para toda la serie: todas las instancias la heredan.
    conferenceData: {
      createRequest: { requestId: `smcr-acuerdo-${acuerdo.id}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    },
  };
}

function enlaceMeet(evento) {
  if (evento?.hangoutLink) return evento.hangoutLink;
  return evento?.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri || null;
}

/** Publica la serie. `sendUpdates: "all"`: es la única invitación que recibe el paciente. */
async function publicarEnGoogle(acuerdo) {
  const refreshToken = acuerdo.professional?.googleRefreshToken;
  if (!refreshToken) return null;
  const calendar = getCalendarClient(refreshToken);
  const { data } = await calendar.events.insert({
    calendarId: acuerdo.professional.googleCalendarId || "primary",
    requestBody: eventoRecurrente(acuerdo),
    sendUpdates: "all",
    conferenceDataVersion: 1,
  });
  return { gcalEventId: data.id || null, meetLink: enlaceMeet(data) };
}

/** Corta la serie en la fecha de fin. Un solo aviso al paciente, no uno por sesión. */
async function cortarEnGoogle(acuerdo) {
  const refreshToken = acuerdo.professional?.googleRefreshToken;
  if (!refreshToken || !acuerdo.gcalEventId) return;
  const calendar = getCalendarClient(refreshToken);
  await calendar.events.patch({
    calendarId: acuerdo.professional.googleCalendarId || "primary",
    eventId: acuerdo.gcalEventId,
    requestBody: { recurrence: reglaDeGoogle(acuerdo) },
    sendUpdates: "all",
  });
}

const DEPS_REALES = {
  publicarEnGoogle,
  cortarEnGoogle,
  scheduleReminder,
  abrirCaso: abrirCasoSiNoExiste,
};

// ─── Citas ───────────────────────────────────────────────────────────────────

/**
 * Crea las citas del tramo pendiente. Idempotente: una sesión que ya tiene cita
 * no se duplica. Una sesión que choca con otra cita del profesional se omite y
 * se informa —la base impide el solapamiento— sin cortar el resto.
 */
export async function generarCitasDelAcuerdo(db, acuerdoId, ahora = new Date()) {
  const acuerdo = await db.acuerdoDeAtencion.findUnique({ where: { id: acuerdoId }, select: SELECT_ACUERDO_COMPLETO });
  if (!acuerdo) return { creadas: 0, omitidas: [] };
  const ventana = ventanaPendiente(acuerdo, ahora);
  if (!ventana) return { creadas: 0, omitidas: [] };

  const sesiones = sesionesDelAcuerdo(acuerdo, ventana);
  const existentes = await db.appointment.findMany({
    where: { acuerdoId, date: { gte: ventana.desde, lt: ventana.hasta } },
    select: { date: true },
  });
  const yaEstan = new Set(existentes.map((a) => a.date.getTime()));

  let creadas = 0;
  const omitidas = [];
  for (const sesion of sesiones) {
    if (yaEstan.has(sesion.start.getTime())) continue;
    try {
      await db.appointment.create({
        data: {
          acuerdoId,
          patientId: acuerdo.patientId,
          professionalId: acuerdo.professionalId,
          serviceId: acuerdo.serviceId,
          date: sesion.start,
          endDate: sesion.end,
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          pricePaid: acuerdo.precioAcordado,
          locationId: acuerdo.locationId,
          modality: acuerdo.modality,
          locationName: acuerdo.locationName,
          isFirstWithProfessional: false,
          gcalEventId: idDeSesionEnGoogle(acuerdo.gcalEventId, sesion.start),
          meetLink: acuerdo.meetLink,
        },
        select: { id: true },
      });
      creadas += 1;
    } catch (error) {
      if (!isAppointmentOverlapError(error)) throw error;
      omitidas.push(sesion.start);
    }
  }

  await db.acuerdoDeAtencion.update({
    where: { id: acuerdoId },
    data: { generadoHasta: new Date(ventana.hasta.getTime() - 1) },
  });
  return { creadas, omitidas };
}

/** Programa los recordatorios de las sesiones de acuerdos de un día tico. */
export async function programarRecordatoriosDelDia(db, ymd, deps = DEPS_REALES) {
  const citas = await db.appointment.findMany({
    where: {
      acuerdoId: { not: null },
      status: { in: ESTADOS_VIGENTES },
      date: { gte: instanteDeHoraCR(ymd, "00:00"), lt: instanteDeHoraCR(crAddDays(ymd, 1), "00:00") },
    },
    select: { id: true, date: true },
  });
  for (const cita of citas) {
    const ms = cita.date.getTime();
    await deps.scheduleReminder({ appointmentId: cita.id, type: "24h", sendAt: new Date(ms - 24 * 3600_000) });
    await deps.scheduleReminder({ appointmentId: cita.id, type: "1h", sendAt: new Date(ms - 3600_000) });
  }
  return citas.length;
}

// ─── Acciones ────────────────────────────────────────────────────────────────

/**
 * Da de alta un acuerdo: lo registra, abre el caso, publica la serie en Google
 * (una sola invitación), genera las primeras citas y programa los recordatorios
 * que la tarea diaria ya no va a cubrir.
 *
 * Google puede fallar sin deshacer el acuerdo: las citas quedan en el CRM y la
 * serie se publica después con `publicarAcuerdoPendiente`.
 */
export async function crearAcuerdo(db, datos = {}, { ahora = new Date(), deps = DEPS_REALES } = {}) {
  const profesional = await db.professionalProfile.findUnique({
    where: { id: String(datos.professionalId || "") },
    select: { id: true, slug: true },
  });
  if (!profesional || !puedeGestionarAcuerdos(profesional.slug)) {
    return falla(403, "Los acuerdos de atención solo los maneja el profesional gestionado.", "ACUERDO_NO_PERMITIDO");
  }

  const [paciente, asignacion, lugar] = await Promise.all([
    db.user.findUnique({ where: { id: String(datos.patientId || "") }, select: { id: true, role: true, isActive: true } }),
    db.serviceAssignment.findUnique({
      where: { professionalId_serviceId: { professionalId: profesional.id, serviceId: String(datos.serviceId || "") } },
      select: { status: true, service: { select: { id: true, durationMin: true, isActive: true } } },
    }),
    datos.locationId
      ? db.practiceLocation.findUnique({
          where: { id: String(datos.locationId) },
          select: { id: true, professionalId: true, isActive: true, modality: true, name: true },
        })
      : null,
  ]);
  if (!paciente || paciente.role !== "USER" || !paciente.isActive) return falla(404, "Paciente no disponible.", "PACIENTE_INVALIDO");
  if (asignacion?.status !== "APPROVED" || !asignacion.service?.isActive) {
    return falla(409, "Ese servicio no está habilitado para este profesional.", "SERVICIO_NO_HABILITADO");
  }
  if (datos.locationId && (!lugar || lugar.professionalId !== profesional.id || !lugar.isActive)) {
    return falla(409, "El lugar de atención no es válido.", "LUGAR_INVALIDO");
  }

  const duracionMin = asignacion.service.durationMin;
  const problema = problemaDeAcuerdo({ ...datos, duracionMin }, ahora);
  if (problema) return falla(400, problema, "ACUERDO_INVALIDO");

  const creado = await db.acuerdoDeAtencion.create({
    data: {
      patientId: paciente.id,
      professionalId: profesional.id,
      serviceId: asignacion.service.id,
      locationId: lugar?.id || null,
      modality: lugar?.modality || null,
      locationName: lugar?.name || null,
      periodicidad: datos.periodicidad,
      inicio: new Date(datos.inicio),
      duracionMin,
      fin: datos.fin ? new Date(datos.fin) : null,
      precioAcordado: Number(datos.precioAcordado),
      estado: ESTADOS_ACUERDO.ACTIVO,
      notas: datos.notas ? String(datos.notas).slice(0, 2000) : null,
      createdBy: datos.createdBy || null,
    },
    select: { id: true },
  });

  await deps.abrirCaso({ patientId: paciente.id, professionalId: profesional.id });
  const google = await publicarAcuerdoPendiente(db, creado.id, deps);
  const citas = await generarCitasDelAcuerdo(db, creado.id, ahora);
  for (const ymd of diasQueProgramaLaCreacion(ahora)) {
    await programarRecordatoriosDelDia(db, ymd, deps);
  }

  return { ok: true, acuerdoId: creado.id, google, ...citas };
}

/**
 * Publica en Google la serie de un acuerdo que todavía no la tiene, y apunta
 * cada cita ya generada a su instancia. Sirve para el alta y para reintentar.
 */
export async function publicarAcuerdoPendiente(db, acuerdoId, deps = DEPS_REALES) {
  const acuerdo = await db.acuerdoDeAtencion.findUnique({ where: { id: acuerdoId }, select: SELECT_ACUERDO_COMPLETO });
  if (!acuerdo || acuerdo.gcalEventId || acuerdo.estado !== ESTADOS_ACUERDO.ACTIVO) {
    return { publicado: Boolean(acuerdo?.gcalEventId) };
  }
  let resultado;
  try {
    resultado = await deps.publicarEnGoogle(acuerdo);
  } catch (error) {
    console.error("[acuerdos] No se pudo publicar la serie en Google:", error?.message);
    return { publicado: false, error: "GOOGLE_NO_DISPONIBLE" };
  }
  if (!resultado?.gcalEventId) return { publicado: false, error: "SIN_GOOGLE" };

  await db.acuerdoDeAtencion.update({ where: { id: acuerdoId }, data: resultado });
  const sinEvento = await db.appointment.findMany({
    where: { acuerdoId, gcalEventId: null, status: { in: ESTADOS_VIGENTES } },
    select: { id: true, date: true },
  });
  for (const cita of sinEvento) {
    await db.appointment.update({
      where: { id: cita.id },
      data: { gcalEventId: idDeSesionEnGoogle(resultado.gcalEventId, cita.date), meetLink: resultado.meetLink },
    });
  }
  return { publicado: true };
}

/**
 * Termina un acuerdo: no genera más citas, cancela las sesiones futuras ya
 * generadas y corta la serie en Google. El paciente recibe un solo aviso, el de
 * Google; las cancelaciones no mandan correo cada una.
 */
export async function terminarAcuerdo(db, acuerdoId, { motivo, ahora = new Date(), deps = DEPS_REALES } = {}) {
  const acuerdo = await db.acuerdoDeAtencion.findUnique({ where: { id: acuerdoId }, select: SELECT_ACUERDO_COMPLETO });
  if (!acuerdo) return falla(404, "El acuerdo no existe.", "ACUERDO_INEXISTENTE");
  if (acuerdo.estado === ESTADOS_ACUERDO.TERMINADO) return falla(409, "El acuerdo ya está terminado.", "ACUERDO_TERMINADO");

  const actualizado = await db.acuerdoDeAtencion.update({
    where: { id: acuerdoId },
    data: { estado: ESTADOS_ACUERDO.TERMINADO, fin: ahora },
    select: SELECT_ACUERDO_COMPLETO,
  });
  const canceladas = await db.appointment.updateMany({
    where: { acuerdoId, date: { gt: ahora }, status: { in: ESTADOS_VIGENTES } },
    data: {
      status: "CANCELLED_BY_PRO",
      canceledBy: "PROFESSIONAL",
      canceledAt: ahora,
      cancelReason: motivo ? `Fin del acuerdo de atención: ${String(motivo).slice(0, 300)}` : "Fin del acuerdo de atención.",
    },
  });

  try {
    await deps.cortarEnGoogle(actualizado);
  } catch (error) {
    console.error("[acuerdos] No se pudo cortar la serie en Google:", error?.message);
    return { ok: true, canceladas: canceladas.count, google: { cortado: false } };
  }
  return { ok: true, canceladas: canceladas.count, google: { cortado: true } };
}

/** La tarea diaria: completa la ventana de cada acuerdo activo y programa recordatorios. */
export async function tareaDiariaDeAcuerdos(db, { ahora = new Date(), deps = DEPS_REALES } = {}) {
  const activos = await db.acuerdoDeAtencion.findMany({
    where: { estado: ESTADOS_ACUERDO.ACTIVO },
    select: { id: true, gcalEventId: true },
  });
  let creadas = 0;
  const omitidas = [];
  const errores = [];
  for (const { id, gcalEventId } of activos) {
    try {
      if (!gcalEventId) await publicarAcuerdoPendiente(db, id, deps);
      const r = await generarCitasDelAcuerdo(db, id, ahora);
      creadas += r.creadas;
      omitidas.push(...r.omitidas.map((fecha) => ({ acuerdoId: id, fecha })));
    } catch (error) {
      // Un acuerdo con problemas no frena a los demás.
      console.error(`[acuerdos] Falló la generación del acuerdo ${id}:`, error?.message);
      errores.push(id);
    }
  }
  const recordatorios = await programarRecordatoriosDelDia(db, diaQueProgramaLaTarea(ahora), deps);
  return { acuerdos: activos.length, creadas, omitidas, errores, recordatorios };
}
