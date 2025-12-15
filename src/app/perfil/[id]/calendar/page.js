// src/app/perfil/[id]/calendar/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

/** Config de agenda (puedes ajustar a tus reglas reales) */
const BUSINESS_START_HOUR = 9;   // 09:00
const BUSINESS_END_HOUR = 17;    // 17:00
const SLOT_MINUTES = 60;         // duración del turno en minutos

/** Util: YYYY-MM-DD seguro */
function getISODateOnly(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formatea hora local corta (HH:mm) */
function formatTime(date) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toTimeString().slice(0, 5);
  }
}

/** Formatea fecha amigable */
function formatDate(date) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return getISODateOnly(date);
  }
}

/** Genera slots (horarios candidatos) de un día local */
function generateSlotsForDay(dateOnly) {
  const slots = [];
  for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) {
    const start = new Date(`${dateOnly}T${String(h).padStart(2, '0')}:00:00`);
    const end = new Date(start.getTime() + SLOT_MINUTES * 60000);
    slots.push({ start, end });
  }
  return slots;
}

/** Chequea si dos rangos [aStart,aEnd) y [bStart,bEnd) se solapan */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/** Obtiene profesional + servicios + turnos disponibles para una fecha */
async function getCalendarData(professionalId, dateOnly) {
  const pro = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: {
      id: true,
      name: true,
      profession: true,
      isApproved: true,
      calendarUrl: true,
      services: {
        orderBy: { title: 'asc' },
        select: { id: true, slug: true, title: true, price: true },
      },
    },
  });
  if (!pro) return null;

  const dayStart = new Date(`${dateOnly}T00:00:00`);
  const dayEnd = new Date(`${dateOnly}T23:59:59.999`);
  const appointments = await prisma.appointment.findMany({
    where: {
      professionalId,
      NOT: { status: 'CANCELLED' },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
    },
    orderBy: { startTime: 'asc' },
  });

  const candidates = generateSlotsForDay(dateOnly);
  const available = candidates.filter(({ start, end }) => {
    return !appointments.some(a => rangesOverlap(start, end, a.startTime, a.endTime));
  });

  return { professional: pro, dateOnly, available, appointments };
}

export default async function ProfessionalCalendarPage({ params, searchParams }) {
  const professionalId = Number(params?.id);
  if (!Number.isInteger(professionalId)) notFound();

  const today = new Date();
  const selectedDate = searchParams?.date || getISODateOnly(today);

  const data = await getCalendarData(professionalId, selectedDate);
  if (!data) notFound();

  const { professional, available, appointments, dateOnly } = data;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { value: getISODateOnly(d), label: formatDate(d) };
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-4">
        <Link href={`/perfil/${professional.id}`} className="text-sm text-blue-600 underline">
          ← Volver al perfil
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Agenda de {professional.name}</h1>
        <p className="text-gray-600">{professional.profession}</p>
        {!professional.isApproved ? (
          <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 inline-block mt-3 text-sm">
            Este perfil aún no está aprobado. Es posible que no puedas reservar.
          </p>
        ) : null}
      </header>

      {/* Selector de fecha */}
      <section className="mb-6">
        <form method="GET" className="flex items-center gap-3">
          <label className="text-sm text-gray-700">Seleccionar fecha:</label>
          <input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="border rounded px-3 py-2"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Ver disponibilidad
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mt-3">
          {days.map(d => (
            <Link
              key={d.value}
              href={`/perfil/${professional.id}/calendar?date=${d.value}`}
              className={`text-sm px-3 py-1 rounded border ${
                d.value === selectedDate ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Turnos disponibles */}
      <section>
        <h2 className="text-xl font-semibold mb-3">
          Disponibilidad para {formatDate(new Date(`${dateOnly}T00:00:00`))}
        </h2>

        {available.length === 0 ? (
          <p className="text-gray-600">
            No hay turnos disponibles para este día. Probá con otra fecha.
          </p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-4">
            {available.map(({ start, end }) => {
              const startLabel = formatTime(start);
              const endLabel = formatTime(end);

              return (
                <li key={start.toISOString()} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {startLabel} – {endLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        Duración: {SLOT_MINUTES} min
                      </div>
                    </div>

                    <form
                      method="POST"
                      action={`/api/calendar/${professional.id}/book`}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="startTime" value={start.toISOString()} />
                      <input type="hidden" name="endTime" value={end.toISOString()} />

                      {professional.services.length > 0 ? (
                        <select
                          name="serviceId"
                          className="border rounded px-2 py-1 text-sm"
                          defaultValue=""
                          aria-label="Seleccionar servicio"
                        >
                          <option value="" disabled>
                            Servicio…
                          </option>
                          {professional.services.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <button
                        type="submit"
                        className="px-3 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                      >
                        Reservar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {appointments.length > 0 ? (
          <div className="mt-8">
            <h3 className="font-semibold mb-2 text-gray-700">Turnos ocupados</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {appointments.map(a => (
                <li key={a.id}>
                  {formatTime(new Date(a.startTime))}–{formatTime(new Date(a.endTime))} · {a.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8 text-sm text-gray-500">
        <p>
          Al hacer clic en <strong>Reservar</strong>, se envía una solicitud al servidor.
          Más adelante podemos mejorar este flujo para mostrar una página de confirmación
          o un mensaje dentro de la misma vista.
        </p>
      </section>
    </main>
  );
}
