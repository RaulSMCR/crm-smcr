// src/lib/calendario-pacientes.js
//
// Lo que el calendario de Google del profesional dice sobre sus pacientes.
//
// Hay pacientes que se atienden desde antes del CRM y viven solo en Google: una
// serie semanal con su correo de invitado. Cuando esa persona se registra, el
// calendario ya sabe con quién se atiende y cada cuánto. Este módulo lo lee para
// dos cosas: sugerirle a la administración emparejamientos que faltan, y dejar
// que un acuerdo de atención adopte la serie existente en vez de publicar otra
// (que le llegaría al paciente como una segunda invitación).
//
// Solo lee. Lo único que se escribe en Google sigue siendo de los acuerdos.

import { getCalendarClient } from "@/lib/google";
import { CALENDARIO_POR_DEFECTO } from "@/lib/google-busy";
import { PERIODICIDADES } from "@/lib/acuerdos-de-atencion";

const TIMEOUT_MS = 8000;
const DIA_MS = 24 * 3600_000;
/** Cuánto hacia atrás y adelante se mira: alcanza para ver cualquier serie viva. */
const VENTANA_DIAS = 60;

/**
 * La periodicidad de acuerdo que corresponde a la regla de una serie de Google,
 * o null si la serie no se puede adoptar tal cual.
 *
 * Se adopta solo lo que el acuerdo puede reproducir sesión por sesión: semanal,
 * quincenal o mensual por día del mes, sin fin. Una serie con fecha de cierre o
 * con varios días por semana generaría citas que en Google no existen.
 */
export function periodicidadDeRegla(recurrence = []) {
  const reglas = (recurrence || []).filter((r) => String(r).startsWith("RRULE:"));
  if (reglas.length !== 1) return null;

  const partes = Object.fromEntries(
    reglas[0]
      .slice("RRULE:".length)
      .split(";")
      .map((p) => p.split("="))
      .map(([k, v]) => [String(k).toUpperCase(), String(v || "").toUpperCase()])
  );
  if (partes.UNTIL || partes.COUNT) return null;

  const intervalo = Number(partes.INTERVAL || 1);
  if (partes.FREQ === "WEEKLY") {
    if (partes.BYDAY && partes.BYDAY.split(",").length > 1) return null;
    if (intervalo === 1) return PERIODICIDADES.WEEKLY;
    if (intervalo === 2) return PERIODICIDADES.BIWEEKLY;
    return null;
  }
  if (partes.FREQ === "MONTHLY") {
    if (intervalo !== 1 || partes.BYDAY || partes.BYSETPOS) return null;
    return PERIODICIDADES.MONTHLY;
  }
  return null;
}

/** Correos de los invitados que no son el dueño del calendario. */
export function correosInvitados(evento) {
  return (evento?.attendees || [])
    .filter((a) => a?.email && !a.self && !a.resource)
    .map((a) => String(a.email).trim().toLowerCase());
}

/**
 * Agrupa los eventos por correo de invitado. Las excepciones de una serie (una
 * instancia movida) vienen como eventos sueltos con `recurringEventId`: se
 * descartan, la serie ya está representada por su maestro.
 */
export function eventosPorCorreo(items = []) {
  const porCorreo = new Map();
  for (const evento of items) {
    if (!evento || evento.status === "cancelled" || evento.recurringEventId) continue;
    const recurrente = Array.isArray(evento.recurrence) && evento.recurrence.length > 0;
    const resumen = {
      id: evento.id,
      titulo: evento.summary || "",
      inicio: evento.start?.dateTime || evento.start?.date || null,
      recurrente,
      periodicidad: recurrente ? periodicidadDeRegla(evento.recurrence) : null,
      propio: Boolean(evento.organizer?.self),
    };
    for (const correo of correosInvitados(evento)) {
      if (!porCorreo.has(correo)) porCorreo.set(correo, []);
      porCorreo.get(correo).push(resumen);
    }
  }
  return porCorreo;
}

async function perfilConGoogle(prisma, professionalId) {
  const perfil = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId || "") },
    select: { id: true, googleRefreshToken: true, googleCalendarId: true },
  });
  return perfil?.googleRefreshToken ? perfil : null;
}

/**
 * Los pacientes registrados que aparecen como invitados en el calendario del
 * profesional, con sus eventos. Lanza si Google falla: quien llama decide cómo
 * avisarlo, porque «no encontré nada» y «no pude mirar» no son lo mismo.
 *
 * @returns {Promise<null | Array<{patientId, name, email, eventos}>>} null si no conectó Google.
 */
export async function pacientesEnElCalendario(prisma, professionalId, ahora = new Date()) {
  const perfil = await perfilConGoogle(prisma, professionalId);
  if (!perfil) return null;

  const calendar = getCalendarClient(perfil.googleRefreshToken);
  const { data } = await calendar.events.list(
    {
      calendarId: perfil.googleCalendarId || CALENDARIO_POR_DEFECTO,
      timeMin: new Date(ahora.getTime() - VENTANA_DIAS * DIA_MS).toISOString(),
      timeMax: new Date(ahora.getTime() + VENTANA_DIAS * DIA_MS).toISOString(),
      // Sin expandir: se quiere el maestro de cada serie, con su regla.
      singleEvents: false,
      maxResults: 2500,
    },
    { timeout: TIMEOUT_MS }
  );

  const porCorreo = eventosPorCorreo(data.items || []);
  if (porCorreo.size === 0) return [];

  const usuarios = await prisma.user.findMany({
    where: { role: "USER", isActive: true, email: { in: [...porCorreo.keys()] } },
    select: { id: true, name: true, email: true },
  });

  return usuarios.map((u) => ({
    patientId: u.id,
    name: u.name,
    email: u.email,
    eventos: porCorreo.get(String(u.email).toLowerCase()) || [],
  }));
}

/**
 * Comprueba que un acuerdo puede adoptar una serie existente y devuelve lo que
 * el acuerdo guarda de ella.
 *
 * La condición de fondo es que cada cita que genere el acuerdo apunte a una
 * instancia real de la serie (`<serie>_<inicio en UTC>`). Por eso se exige que
 * la primera sesión del acuerdo sea exactamente una instancia de Google, que la
 * regla tenga la misma periodicidad y que el profesional sea el organizador: al
 * terminar el acuerdo, la serie se corta desde acá.
 *
 * @returns {Promise<{ok: true, gcalEventId: string, meetLink: string|null} | {ok: false, message: string}>}
 */
export async function verificarSerieParaAcuerdo(prisma, { professionalId, serieId, periodicidad, inicio, patientEmail }) {
  const perfil = await perfilConGoogle(prisma, professionalId);
  if (!perfil) return { ok: false, message: "El calendario de Google no está conectado." };

  const calendar = getCalendarClient(perfil.googleRefreshToken);
  const calendarId = perfil.googleCalendarId || CALENDARIO_POR_DEFECTO;

  let serie;
  try {
    ({ data: serie } = await calendar.events.get({ calendarId, eventId: String(serieId) }, { timeout: TIMEOUT_MS }));
  } catch {
    return { ok: false, message: "No se encontró esa serie en su calendario de Google." };
  }

  if (serie.status === "cancelled") return { ok: false, message: "Esa serie está cancelada en Google." };
  if (!serie.organizer?.self) {
    return { ok: false, message: "La serie no la organiza usted, así que el acuerdo no podría terminarla después." };
  }
  if (periodicidadDeRegla(serie.recurrence) !== periodicidad) {
    return { ok: false, message: "La periodicidad elegida no coincide con la de la serie en Google." };
  }
  if (patientEmail && !correosInvitados(serie).includes(String(patientEmail).toLowerCase())) {
    return { ok: false, message: "El paciente no está invitado a esa serie." };
  }

  const primera = new Date(inicio);
  const { data: instancias } = await calendar.events.instances(
    {
      calendarId,
      eventId: serie.id,
      timeMin: new Date(primera.getTime() - 60_000).toISOString(),
      maxResults: 1,
    },
    { timeout: TIMEOUT_MS }
  );
  const instancia = instancias.items?.[0];
  const original = instancia?.originalStartTime?.dateTime || instancia?.start?.dateTime;
  if (!original || new Date(original).getTime() !== primera.getTime()) {
    return { ok: false, message: "La primera sesión del acuerdo tiene que ser una sesión de la serie de Google." };
  }

  const meetLink =
    serie.hangoutLink || serie.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri || null;
  return { ok: true, gcalEventId: serie.id, meetLink };
}

/**
 * La próxima sesión de una serie, desde hoy (hora de inicio original). Sirve
 * para precargar el formulario del acuerdo.
 */
export async function proximaSesionDeSerie(prisma, { professionalId, serieId }, ahora = new Date()) {
  const perfil = await perfilConGoogle(prisma, professionalId);
  if (!perfil) return null;
  const calendar = getCalendarClient(perfil.googleRefreshToken);
  const { data } = await calendar.events.instances(
    {
      calendarId: perfil.googleCalendarId || CALENDARIO_POR_DEFECTO,
      eventId: String(serieId),
      timeMin: ahora.toISOString(),
      maxResults: 1,
    },
    { timeout: TIMEOUT_MS }
  );
  const instancia = data.items?.[0];
  return instancia?.originalStartTime?.dateTime || instancia?.start?.dateTime || null;
}
