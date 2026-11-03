import { describe, expect, it } from "vitest";
import { buildRecurringStarts, normalizeRecurrenceCount } from "@/lib/appointment-recurrence";
import { toGoogleDateTime } from "@/lib/timezone";
import { buildSlots } from "@/lib/appointment-slots";

describe("recurrencia y zona horaria", () => {
  it("limita la recurrencia al máximo configurado", () => {
    expect(normalizeRecurrenceCount(99)).toBe(12);
    // Cada 4 semanas: siempre el mismo día de la semana. Lunes 16-nov-2026 a
    // las 19:00 de Costa Rica → 14-dic → 11-ene, todos lunes a la misma hora.
    expect(
      buildRecurringStarts(new Date("2026-11-17T01:00:00Z"), "EVERY_4_WEEKS", 3).map((date) => date.toISOString())
    ).toEqual(["2026-11-17T01:00:00.000Z", "2026-12-15T01:00:00.000Z", "2027-01-12T01:00:00.000Z"]);
  });

  it("formatea la cita en la zona de Costa Rica", () => {
    expect(toGoogleDateTime("2026-01-15T18:30:00Z")).toBe("2026-01-15T12:30:00");
  });

  it("excluye intervalos reservados y respeta el límite de días", () => {
    const now = new Date("2026-01-05T00:00:00-06:00");
    const days = buildSlots({
      now, daysAhead: 1, durationMin: 60,
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" },
      ],
      booked: [{ startISO: "2026-01-05T10:00:00-06:00", endISO: "2026-01-05T11:00:00-06:00" }],
    });
    expect(days).toHaveLength(1);
    expect(days[0].day.toISOString()).toBe("2026-01-05T06:00:00.000Z");
    expect(days[0].slots.map((slot) => slot.start.toISOString())).toEqual([
      "2026-01-05T15:00:00.000Z", "2026-01-05T17:00:00.000Z",
    ]);
  });

  it("usa el día de Costa Rica aunque el instante ya sea el día siguiente en UTC", () => {
    const days = buildSlots({
      now: new Date("2026-01-06T01:00:00Z"), daysAhead: 1, durationMin: 60,
      availability: [{ dayOfWeek: 1, startTime: "20:00", endTime: "22:00" }],
    });
    expect(days).toHaveLength(1);
    expect(days[0].day.toISOString()).toBe("2026-01-05T06:00:00.000Z");
    expect(days[0].slots.map((slot) => slot.start.toISOString())).toEqual([
      "2026-01-06T02:00:00.000Z", "2026-01-06T03:00:00.000Z",
    ]);
  });
});
