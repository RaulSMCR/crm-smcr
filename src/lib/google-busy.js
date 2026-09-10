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

/**
 * Se consulta el calendario principal, que es el mismo donde la app publica.
 * Mirar todos los calendarios de la cuenta traería cumpleaños y suscripciones
 * ajenas al ejercicio profesional.
 */
const CALENDAR_ID = "primary";

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
function ocupaAgenda(event) {
  if (!event) return false;
  if (event.status === "cancelled") return false;
  if (event.transparency === "transparent") return false;

  const selfAttendee = event.attendees?.find((attendee) => attendee.self);
  if (selfAttendee?.responseStatus === "declined") return false;

  return true;
}

/**
 * Convierte el par start/end de Google en instantes.
 *
 * Los eventos con hora traen `dateTime`; los de día completo traen `date` como
 * 'YYYY-MM-DD', y en ese caso el `end` de Google es exclusivo, así que el rango
 * ya queda bien sin ajustarlo.
 */
function toInterval(event) {
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;
  if (!startRaw || !endRaw) return null;

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

  return { startISO: start.toISOString(), endISO: end.toISOString() };
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
}) {
  if (!refreshToken || !from || !to) return [];

  try {
    const calendar = getCalendarClient(refreshToken);
    const excluded = new Set(excludeEventIds.filter(Boolean));

    const response = await calendar.events.list(
      {
        calendarId: CALENDAR_ID,
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
      .filter(ocupaAgenda)
      .map(toInterval)
      .filter(Boolean);
  } catch (error) {
    console.error("No se pudo leer el calendario de Google:", {
      message: error?.message,
      code: error?.code,
      reason: error?.response?.data?.error,
    });
    return [];
  }
}

/**
 * Igual que la anterior, pero resolviendo el token desde el perfil.
 *
 * Corta antes de tocar la red si el profesional no conectó Google, que es el
 * caso de la mayoría: así la funcionalidad no le cuesta latencia a quien no la
 * usa.
 */
export async function fetchBusyForProfessional({ prisma, professionalId, from, to, excludeEventIds }) {
  if (!professionalId) return [];

  const profile = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId) },
    select: { googleRefreshToken: true },
  });

  if (!profile?.googleRefreshToken) return [];

  return fetchGoogleBusyIntervals({
    refreshToken: profile.googleRefreshToken,
    from,
    to,
    excludeEventIds,
  });
}
