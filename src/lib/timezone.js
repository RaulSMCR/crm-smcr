const DEFAULT_TZ = "America/Costa_Rica";

function getPartsInTimeZone(date, timeZone = DEFAULT_TZ) {
  const d = date instanceof Date ? date : new Date(date);

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
    hour: byType.hour,
    minute: byType.minute,
    second: byType.second,
  };
}

export function toGoogleDateTime(date, timeZone = DEFAULT_TZ) {
  const p = getPartsInTimeZone(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export function formatDateTimeInTZ(date, locale = "es-CR", timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(date));
}

export { DEFAULT_TZ };
