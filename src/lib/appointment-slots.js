function parseHHMM(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map((part) => Number(part));
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export function buildSlots({ availability = [], durationMin = 60, booked = [], daysAhead = 14, now = new Date() }) {
  const bookedIntervals = booked.map((item) => ({
    start: new Date(item.startISO).getTime(),
    end: new Date(item.endISO).getTime(),
  }));

  const byDayOfWeek = new Map();
  for (const block of availability) {
    const list = byDayOfWeek.get(block.dayOfWeek) || [];
    list.push(block);
    byDayOfWeek.set(block.dayOfWeek, list);
  }

  const days = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);

    const slots = [];
    const windows = byDayOfWeek.get(day.getDay()) || [];

    for (const window of windows) {
      const startMin = parseHHMM(window.startTime);
      const endMin = parseHHMM(window.endTime);

      for (let minutes = startMin; minutes + durationMin <= endMin; minutes += durationMin) {
        const start = new Date(day);
        start.setMinutes(minutes, 0, 0);

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + durationMin);

        if (start <= now) continue;

        const startMs = start.getTime();
        const endMs = end.getTime();
        const isTaken = bookedIntervals.some((interval) =>
          overlaps(startMs, endMs, interval.start, interval.end)
        );

        if (!isTaken) slots.push({ start, end });
      }
    }

    if (slots.length > 0) days.push({ day, slots });
  }

  return days;
}

export function formatDayTab(date) {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatSlotTime(date) {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSelectedLabel(date) {
  return new Intl.DateTimeFormat("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
