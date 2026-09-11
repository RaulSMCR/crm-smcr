import { afterEach, describe, expect, it, vi } from "vitest";

// 2026-09-14 es lunes. La semana tipo se declara en hora de Costa Rica.
const LUNES = "2026-09-14";
const DOMINGO_ANTERIOR = new Date("2026-09-13T12:00:00-06:00");
const SEMANA_TIPO = [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }];

const zonaOriginal = process.env.TZ;

/**
 * Carga el módulo con otra zona horaria de proceso. Vitest corre cada archivo en
 * su propio proceso, así que cambiar TZ acá no toca a los demás tests.
 */
async function slotsConZona(zona) {
  process.env.TZ = zona;
  vi.resetModules();
  return import("@/lib/appointment-slots");
}

afterEach(() => {
  if (zonaOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaOriginal;
});

describe("buildSlotDaysCR", () => {
  it("arma los cupos con la duración del servicio, en hora de Costa Rica", async () => {
    const { buildSlotDaysCR } = await slotsConZona("America/Costa_Rica");

    expect(
      buildSlotDaysCR({ availability: SEMANA_TIPO, durationMin: 50, daysAhead: 2, now: DOMINGO_ANTERIOR })
    ).toEqual([{ date: LUNES, slots: ["09:00", "09:50", "10:40"] }]);
  });

  it("da los mismos cupos sin importar la zona horaria del servidor", async () => {
    // Vercel corre en UTC. La página pública armaba los cupos con fechas locales
    // del servidor y el cruce con lo ocupado quedaba corrido seis horas.
    for (const zona of ["UTC", "Europe/Oslo", "America/Buenos_Aires", "Asia/Tokyo"]) {
      const { buildSlotDaysCR } = await slotsConZona(zona);

      expect(
        buildSlotDaysCR({ availability: SEMANA_TIPO, durationMin: 50, daysAhead: 2, now: DOMINGO_ANTERIOR }),
        zona
      ).toEqual([{ date: LUNES, slots: ["09:00", "09:50", "10:40"] }]);
    }
  });

  it("no ofrece lo que ocupa la agenda, venga de Google, de un bloqueo o de una cita", async () => {
    const { buildSlotDaysCR } = await slotsConZona("UTC");
    // Un evento de 09:30 a 10:00 pisa los dos primeros cupos de 50 minutos.
    const booked = [{ startISO: "2026-09-14T09:30:00-06:00", endISO: "2026-09-14T10:00:00-06:00" }];

    expect(
      buildSlotDaysCR({ availability: SEMANA_TIPO, durationMin: 50, booked, daysAhead: 2, now: DOMINGO_ANTERIOR })
    ).toEqual([{ date: LUNES, slots: ["10:40"] }]);
  });

  it("omite el día entero cuando un bloqueo lo cubre", async () => {
    const { buildSlotDaysCR } = await slotsConZona("UTC");
    const booked = [{ startISO: "2026-09-14T00:00:00-06:00", endISO: "2026-09-15T00:00:00-06:00" }];

    expect(
      buildSlotDaysCR({ availability: SEMANA_TIPO, durationMin: 50, booked, daysAhead: 2, now: DOMINGO_ANTERIOR })
    ).toEqual([]);
  });

  it("arranca la ventana en startDay y deja afuera los días sin consulta", async () => {
    const { buildSlotDaysCR } = await slotsConZona("UTC");
    const base = { availability: SEMANA_TIPO, durationMin: 60, now: DOMINGO_ANTERIOR };

    expect(buildSlotDaysCR({ ...base, startDay: "2026-09-21", daysAhead: 1 })).toEqual([
      { date: "2026-09-21", slots: ["09:00", "10:00", "11:00"] },
    ]);
    // Martes: la semana tipo no tiene consulta ese día.
    expect(buildSlotDaysCR({ ...base, startDay: "2026-09-15", daysAhead: 1 })).toEqual([]);
  });

  it("no ofrece cupos que ya empezaron", async () => {
    const { buildSlotDaysCR } = await slotsConZona("UTC");
    const now = new Date("2026-09-14T09:10:00-06:00");

    expect(buildSlotDaysCR({ availability: SEMANA_TIPO, durationMin: 60, daysAhead: 1, now })).toEqual([
      { date: LUNES, slots: ["10:00", "11:00"] },
    ]);
  });
});
