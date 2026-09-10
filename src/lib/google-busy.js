import { getCalendarClient } from "@/lib/google";

/**
 * Lo que ya ocupa el calendario de Google del profesional.
 *
 * La sincronización con Google era de ida solamente: el sistema publicaba sus
 * citas allá, pero no miraba lo que el profesional tuviera agendado por su
 * cuenta. Eso dejaba a la vista horarios que en realidad no existían, y el
 * paciente podía reservar encima de un compromiso ya tomado.
 *
 * Este módulo cierra esa vuelta. Devuelve intervalos ocupados en el mismo
 * formato que usan las citas y los bloqueos, para que el resto del sistema no
 * tenga que saber de dónde salieron.
 */

/** Donde escribía la app antes de que el calendario fuera configurable. */
export const CALENDARIO_POR_DEFECTO = "primary";

/**
 * `freebusy` rechaza la consulta con `tooManyCalendarsRequested` cuando se le
 * pasan muchos calendarios de golpe, y lo hace devolviendo cero bloques por
 * calendario en vez de un error claro: parece que no hay nada ocupado. Se
 * consulta en lotes chicos para que eso no pueda pasar.
 */
const LOTE_FREEBUSY = 5;

/** Google puede tardar; ocho segundos es más de lo que nadie espera mirando una pantalla. */
const TIMEOUT_MS = 8000;

/**
 * Un evento de Google ocupa la agenda salvo que diga lo contrario.
 *
 * - `transparent` es el "Disponible" de Google. Los eventos de día completo
 *   nacen así por defecto, que es justo lo que se quiere: un cumpleaños no
 *   cierra la consulta, pero unas vacaciones marcadas como ocupado sí.
 * - Un evento que el profesional rechazó no le ocupa el tiempo.
 * - Los cancelados llegan igual cuando se piden instancias sueltas.
 */
/** 'YYYY-MM-DD' → medianoche de Costa Rica, no de UTC. */
function anclarDiaCompleto(fecha) {
  if (!fecha) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T00:00:00${CR_OFFSET}` : fecha;
}

function ocupaAgenda(event, { respetarDisponible = true } = {}) {
  if (!event) return false;
  if (event.status === "cancelled") return false;
  if (respetarDisponible && event.transparency === "transparent") return false;

  const selfAttendee = event.attendees?.find((attendee) => attendee.self);
  if (selfAttendee?.responseStatus === "declined") return false;

  return true;
}

/**
 * Costa Rica no aplica horario de verano, así que el offset es siempre -06:00.
 * Es la zona del negocio y la misma en que el profesional declara su franja.
 */
const CR_OFFSET = "-06:00";

/**
 * Convierte el par start/end de Google en instantes.
 *
 * Los eventos con hora traen `dateTime`, que ya lleva su propio offset. Los de
 * día completo traen `date` como 'YYYY-MM-DD' pelado, y ahí está la trampa:
 * `new Date("2026-09-15")` lo interpreta como medianoche **UTC**, que en Costa
 * Rica son las seis de la tarde del día anterior. Un feriado quedaba corrido
 * seis horas —bloqueaba la tarde del 14 y dejaba abierta la del 15—, así que se
 * ancla explícitamente a la hora tica.
 *
 * El `end` de los de día completo es exclusivo en Google, y al anclar los dos
 * extremos igual el rango cubre exactamente el día calendario tico.
 */
function toInterval(event) {
  const startRaw = event.start?.dateTime || anclarDiaCompleto(event.start?.date);
  const endRaw = event.end?.dateTime || anclarDiaCompleto(event.end?.date);
  if (!startRaw || !endRaw) return null;

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    // El título solo lo consume la vista de agenda del propio profesional. Las
    // rutas de reserva lo ignoran: ahí un intervalo ocupado es un intervalo
    // ocupado, sin importar qué diga.
    summary: event.summary || "",
  };
}

/**
 * Los intervalos ocupados del calendario de Google entre `from` y `to`.
 *
 * `excludeEventIds` son los eventos que la propia app publicó: sus citas ya se
 * cuentan por la base de datos, y volver a contarlas desde Google rompería la
 * reprogramación —al mover una cita, el sistema chocaría contra su propio
 * evento todavía sin actualizar.
 *
 * Nunca lanza. Si Google falla, el token fue revocado o la red se cae, devuelve
 * una lista vacía y lo registra. Es deliberado: dejar de mostrar horarios ante
 * una caída de Google sería peor que el riesgo que evita, y el profesional
 * conserva los bloqueos propios del sistema, que no dependen de nadie.
 */
export async function fetchGoogleBusyIntervals({
  refreshToken,
  from,
  to,
  excludeEventIds = [],
  calendarId = CALENDARIO_POR_DEFECTO,
  respetarDisponible = true,
}) {
  if (!refreshToken || !from || !to) return [];

  try {
    const calendar = getCalendarClient(refreshToken);
    const excluded = new Set(excludeEventIds.filter(Boolean));

    const response = await calendar.events.list(
      {
        calendarId,
        timeMin: new Date(from).toISOString(),
        timeMax: new Date(to).toISOString(),
        // Expande las series: una supervisión semanal tiene que ocupar todas
        // sus semanas, no solo la primera.
        singleEvents: true,
        maxResults: 2500,
      },
      { timeout: TIMEOUT_MS }
    );

    return (response.data.items || [])
      .filter((event) => !excluded.has(event.id))
      .filter((event) => ocupaAgenda(event, { respetarDisponible }))
      .map(toInterval)
      .filter(Boolean);
  } catch (error) {
    // 403 significa que sobre este calendario solo se puede consultar
    // disponibilidad. Se propaga para que el llamador use `freebusy`.
    if (error?.code === 403 || error?.response?.status === 403) throw error;

    console.error("No se pudo leer el calendario de Google:", {
      calendarId,
      message: error?.message,
      code: error?.code,
      reason: error?.response?.data?.error,
    });
    return [];
  }
}

/**
 * Los ratos ocupados en los calendarios que el profesional marcó como "también
 * me ocupan".
 *
 * Se intenta `events.list` primero y se cae a `freebusy` solo si Google
 * responde 403. El orden importa: sobre los calendarios públicos de feriados se
 * tiene acceso `reader`, y ahí `freebusy` responde `notFound` —no un error
 * visible, sino cero bloques— mientras que `events.list` funciona sin problema.
 * Hacerlo al revés dejaba los feriados sin aportar nada en silencio.
 *
 * Estos calendarios se leen **sin respetar la marca "Disponible"** de Google.
 * Los feriados vienen todos marcados así, y filtrarlos los habría dejado en
 * cero: si el profesional se tomó el trabajo de marcar un calendario como algo
 * que le ocupa el tiempo, eso ya es la declaración de intención.
 */
async function fetchCalendariosExtra({ refreshToken, calendarIds, from, to }) {
  const ids = [...new Set((calendarIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const intervalos = [];
  const soloDisponibilidad = [];

  for (const id of ids) {
    try {
      const eventos = await fetchGoogleBusyIntervals({
        refreshToken,
        from,
        to,
        calendarId: id,
        respetarDisponible: false,
      });
      intervalos.push(...eventos);
    } catch (error) {
      // 403: solo se puede consultar disponibilidad. Va al lote de freebusy.
      soloDisponibilidad.push(id);
    }
  }

  if (soloDisponibilidad.length) {
    intervalos.push(...(await fetchFreeBusy({ refreshToken, calendarIds: soloDisponibilidad, from, to })));
  }

  return intervalos;
}

/** Disponibilidad pura, para los calendarios donde no se pueden leer eventos. */
async function fetchFreeBusy({ refreshToken, calendarIds, from, to }) {
  const ids = [...new Set((calendarIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const intervalos = [];

  try {
    const calendar = getCalendarClient(refreshToken);

    for (let i = 0; i < ids.length; i += LOTE_FREEBUSY) {
      const lote = ids.slice(i, i + LOTE_FREEBUSY);

      const response = await calendar.freebusy.query(
        {
          requestBody: {
            timeMin: new Date(from).toISOString(),
            timeMax: new Date(to).toISOString(),
            items: lote.map((id) => ({ id })),
          },
        },
        { timeout: TIMEOUT_MS }
      );

      for (const id of lote) {
        const entrada = response.data.calendars?.[id];

        // Un calendario dado de baja o inaccesible responde `notFound`. Se
        // registra y se sigue: un calendario roto no puede tumbar la agenda.
        if (entrada?.errors?.length) {
          console.warn("Calendario de Google no consultable:", id, entrada.errors[0]?.reason);
          continue;
        }

        for (const rango of entrada?.busy || []) {
          intervalos.push({
            startISO: new Date(rango.start).toISOString(),
            endISO: new Date(rango.end).toISOString(),
            summary: "",
          });
        }
      }
    }
  } catch (error) {
    console.error("No se pudo consultar freebusy:", { message: error?.message, code: error?.code });
  }

  return intervalos;
}

/**
 * Todo lo que le ocupa la agenda al profesional en Google, resolviendo la
 * configuración desde su perfil.
 *
 * Corta antes de tocar la red si no conectó Google, que es el caso de la
 * mayoría: así la funcionalidad no le cuesta latencia a quien no la usa.
 */
export async function fetchBusyForProfessional({ prisma, professionalId, from, to, excludeEventIds }) {
  if (!professionalId) return [];

  const profile = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId) },
    select: {
      googleRefreshToken: true,
      googleCalendarId: true,
      googleBusyCalendarIds: true,
    },
  });

  if (!profile?.googleRefreshToken) return [];

  const calendarioDeTrabajo = profile.googleCalendarId || CALENDARIO_POR_DEFECTO;

  const [propios, extras] = await Promise.all([
    fetchGoogleBusyIntervals({
      refreshToken: profile.googleRefreshToken,
      from,
      to,
      excludeEventIds,
      calendarId: calendarioDeTrabajo,
    }),
    fetchCalendariosExtra({
      refreshToken: profile.googleRefreshToken,
      // El de trabajo ya se leyó arriba con detalle; incluirlo de nuevo
      // duplicaría cada banda en la vista de agenda.
      calendarIds: (profile.googleBusyCalendarIds || []).filter((id) => id !== calendarioDeTrabajo),
      from,
      to,
    }),
  ]);

  return [...propios, ...extras];
}
